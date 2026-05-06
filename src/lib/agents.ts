import { and, desc, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent, agentSubagent, agentTool } from "@/db/schemas/agent-schema";
import { Database, runQuery } from "@/db/service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

interface AgentToolInput {
  config: unknown;
  toolId: string;
}

interface AgentSubAgentInput {
  alias: string;
  childAgentId: string;
  descriptionOverride?: string;
}

interface AgentInput {
  defaultModelId: string;
  description?: string;
  name: string;
  subAgents: AgentSubAgentInput[];
  systemPrompt: string;
  tools: AgentToolInput[];
}

export const listAgentsForUser = (userId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    return yield* runQuery(() => {
      return db
        .select({
          createdAt: agent.createdAt,
          defaultModelId: agent.defaultModelId,
          description: agent.description,
          id: agent.id,
          isSystem: agent.isSystem,
          name: agent.name,
          updatedAt: agent.updatedAt,
        })
        .from(agent)
        .where(eq(agent.userId, userId))
        .orderBy(desc(agent.updatedAt));
    });
  });
};

export const getAgentForUser = (agentId: string, userId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* runQuery(() => {
      return db
        .select()
        .from(agent)
        .where(and(eq(agent.id, agentId), eq(agent.userId, userId)))
        .limit(1);
    });

    const row = rows.at(0);

    if (!row) {
      return yield* Effect.fail(new NotFoundError({ resource: "agent" }));
    }

    const [tools, subAgents] = yield* Effect.all(
      [
        runQuery(() => {
          return db
            .select({ config: agentTool.config, toolId: agentTool.toolId })
            .from(agentTool)
            .where(eq(agentTool.agentId, agentId));
        }),
        runQuery(() => {
          return db
            .select({
              alias: agentSubagent.alias,
              childAgentId: agentSubagent.childAgentId,
              descriptionOverride: agentSubagent.descriptionOverride,
            })
            .from(agentSubagent)
            .where(eq(agentSubagent.parentAgentId, agentId));
        }),
      ],
      { concurrency: "unbounded" },
    );

    return { ...row, subAgents, tools };
  });
};

export const assertAgentOwnership = (agentId: string, userId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* runQuery(() => {
      return db.select({ userId: agent.userId }).from(agent).where(eq(agent.id, agentId)).limit(1);
    });

    const row = rows.at(0);

    if (!row) {
      return yield* Effect.fail(new NotFoundError({ resource: "agent" }));
    }

    if (row.userId !== userId) {
      return yield* Effect.fail(new ForbiddenError());
    }

    return undefined;
  });
};

export const createAgent = (userId: string, input: AgentInput) => {
  return Effect.gen(function* () {
    const db = yield* Database;
    const id = nanoid();

    yield* runQuery(() => {
      return db.transaction(async (tx) => {
        await tx.insert(agent).values({
          defaultModelId: input.defaultModelId,
          description: input.description,
          id,
          name: input.name,
          systemPrompt: input.systemPrompt,
          userId,
        });

        if (input.tools.length > 0) {
          await tx.insert(agentTool).values(
            input.tools.map((tool) => {
              return { agentId: id, config: tool.config, toolId: tool.toolId };
            }),
          );
        }

        if (input.subAgents.length > 0) {
          await tx.insert(agentSubagent).values(
            input.subAgents.map((subAgent) => {
              return {
                alias: subAgent.alias,
                childAgentId: subAgent.childAgentId,
                descriptionOverride: subAgent.descriptionOverride,
                parentAgentId: id,
              };
            }),
          );
        }
      });
    });

    return { id };
  });
};

export const updateAgent = (agentId: string, input: AgentInput) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* runQuery(() => {
      return db.transaction(async (tx) => {
        await tx
          .update(agent)
          .set({
            defaultModelId: input.defaultModelId,
            description: input.description,
            name: input.name,
            systemPrompt: input.systemPrompt,
          })
          .where(eq(agent.id, agentId));

        await tx.delete(agentTool).where(eq(agentTool.agentId, agentId));
        await tx.delete(agentSubagent).where(eq(agentSubagent.parentAgentId, agentId));

        if (input.tools.length > 0) {
          await tx.insert(agentTool).values(
            input.tools.map((tool) => {
              return { agentId, config: tool.config, toolId: tool.toolId };
            }),
          );
        }

        if (input.subAgents.length > 0) {
          await tx.insert(agentSubagent).values(
            input.subAgents.map((subAgent) => {
              return {
                alias: subAgent.alias,
                childAgentId: subAgent.childAgentId,
                descriptionOverride: subAgent.descriptionOverride,
                parentAgentId: agentId,
              };
            }),
          );
        }
      });
    });
  });
};

export const deleteAgent = (agentId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* runQuery(() => db.delete(agent).where(eq(agent.id, agentId)));
  });
};

export const listOwnerSubAgentEdges = (userId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    return yield* runQuery(() => {
      return db
        .select({
          childAgentId: agentSubagent.childAgentId,
          parentAgentId: agentSubagent.parentAgentId,
        })
        .from(agentSubagent)
        .innerJoin(agent, eq(agent.id, agentSubagent.parentAgentId))
        .where(eq(agent.userId, userId));
    });
  });
};

export const listOwnedAgentIds = (userId: string, agentIds: string[]) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    if (agentIds.length === 0) return [] as { id: string }[];

    return yield* runQuery(() => {
      return db
        .select({ id: agent.id })
        .from(agent)
        .where(and(eq(agent.userId, userId), inArray(agent.id, agentIds)));
    });
  });
};
