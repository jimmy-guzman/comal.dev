import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import type { Scorer } from "@/lib/eval-input-schema";

import { agent, agentSubagent, agentTool, agentVersion } from "@/db/schemas/agent-schema";
import { user } from "@/db/schemas/auth-schema";
import { agentEval } from "@/db/schemas/eval-schema";
import { Database, runMutation, runQuery } from "@/db/service";
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

interface AgentEvalInput {
  expected: string;
  id?: string;
  input: string;
  name: string;
  scorer: Scorer;
}

interface AgentInput {
  defaultModelId: string;
  description?: string;
  evals: AgentEvalInput[];
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

    const [tools, subAgents, evals] = yield* Effect.all(
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
        runQuery(() => {
          return db
            .select({
              expected: agentEval.expected,
              id: agentEval.id,
              input: agentEval.input,
              name: agentEval.name,
              scorer: agentEval.scorer,
            })
            .from(agentEval)
            .where(eq(agentEval.agentId, agentId));
        }),
      ],
      { concurrency: "unbounded" },
    );

    return { ...row, evals, subAgents, tools };
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

const buildVersionTools = (tools: AgentToolInput[]) => {
  return tools.map(({ config, toolId }) => ({ config, toolId }));
};

const buildVersionSubAgents = (subAgents: AgentSubAgentInput[]) => {
  return subAgents.map(({ alias, childAgentId, descriptionOverride }) => {
    return { alias, childAgentId, descriptionOverride: descriptionOverride ?? null };
  });
};

const buildVersionEvals = (evals: AgentEvalInput[]) => {
  return evals.map(({ expected, id, input, name, scorer }) => {
    return { expected, id: id ?? "", input, name, scorer };
  });
};

export const createAgent = (userId: string, input: AgentInput) => {
  return Effect.gen(function* () {
    const db = yield* Database;
    const id = nanoid();

    yield* runMutation(() => {
      return db.transaction(async (tx) => {
        await tx.insert(agent).values({
          defaultModelId: input.defaultModelId,
          description: input.description,
          id,
          name: input.name,
          systemPrompt: input.systemPrompt,
          userId,
        });

        await tx.insert(agentVersion).values({
          agentId: id,
          createdBy: userId,
          evals: buildVersionEvals(input.evals),
          id: nanoid(),
          modelId: input.defaultModelId,
          subAgents: buildVersionSubAgents(input.subAgents),
          systemPrompt: input.systemPrompt,
          tools: buildVersionTools(input.tools),
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

        if (input.evals.length > 0) {
          await tx.insert(agentEval).values(
            input.evals.map((evalEntry) => {
              return {
                agentId: id,
                expected: evalEntry.expected,
                id: nanoid(),
                input: evalEntry.input,
                name: evalEntry.name,
                scorer: evalEntry.scorer,
              };
            }),
          );
        }
      });
    });

    return { id };
  });
};

export const updateAgent = (agentId: string, userId: string, input: AgentInput) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* runMutation(() => {
      return db.transaction(async (tx) => {
        await tx.insert(agentVersion).values({
          agentId,
          createdBy: userId,
          evals: buildVersionEvals(input.evals),
          id: nanoid(),
          modelId: input.defaultModelId,
          subAgents: buildVersionSubAgents(input.subAgents),
          systemPrompt: input.systemPrompt,
          tools: buildVersionTools(input.tools),
        });

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

        const keepEvalIds = input.evals
          .map((e) => e.id)
          .filter((id): id is string => id !== undefined);

        await (keepEvalIds.length > 0
          ? tx
              .delete(agentEval)
              .where(and(eq(agentEval.agentId, agentId), notInArray(agentEval.id, keepEvalIds)))
          : tx.delete(agentEval).where(eq(agentEval.agentId, agentId)));

        for (const evalEntry of input.evals) {
          await (evalEntry.id
            ? tx
                .update(agentEval)
                .set({
                  expected: evalEntry.expected,
                  input: evalEntry.input,
                  name: evalEntry.name,
                  scorer: evalEntry.scorer,
                })
                .where(and(eq(agentEval.id, evalEntry.id), eq(agentEval.agentId, agentId)))
            : tx.insert(agentEval).values({
                agentId,
                expected: evalEntry.expected,
                id: nanoid(),
                input: evalEntry.input,
                name: evalEntry.name,
                scorer: evalEntry.scorer,
              }));
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

export type AgentVersionRow = Pick<
  typeof agentVersion.$inferSelect,
  "createdAt" | "createdBy" | "evals" | "id" | "modelId" | "subAgents" | "systemPrompt" | "tools"
> & { creatorName: string };

export const listAgentVersions = (agentId: string, userId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    return yield* runQuery(() => {
      return db
        .select({
          createdAt: agentVersion.createdAt,
          createdBy: agentVersion.createdBy,
          creatorName: user.name,
          evals: agentVersion.evals,
          id: agentVersion.id,
          modelId: agentVersion.modelId,
          subAgents: agentVersion.subAgents,
          systemPrompt: agentVersion.systemPrompt,
          tools: agentVersion.tools,
        })
        .from(agentVersion)
        .innerJoin(user, eq(user.id, agentVersion.createdBy))
        .innerJoin(agent, eq(agent.id, agentVersion.agentId))
        .where(and(eq(agentVersion.agentId, agentId), eq(agent.userId, userId)))
        .orderBy(desc(agentVersion.createdAt));
    });
  });
};

export const getAgentVersion = (versionId: string, agentId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* runQuery(() => {
      return db
        .select()
        .from(agentVersion)
        .where(and(eq(agentVersion.id, versionId), eq(agentVersion.agentId, agentId)))
        .limit(1);
    });

    const row = rows.at(0);

    if (!row) {
      return yield* Effect.fail(new NotFoundError({ resource: "agent version" }));
    }

    return row;
  });
};
