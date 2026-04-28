import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent, agentTool } from "@/db/schemas/agent-schema";
import { conversation } from "@/db/schemas/chat-schema";
import { Database, runQuery } from "@/db/service";
import { DatabaseError, ForbiddenError, NotFoundError } from "@/lib/errors";

interface AgentToolInput {
  config: unknown;
  toolId: string;
}

interface AgentInput {
  defaultModelId: string;
  description?: string;
  name: string;
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

    const tools = yield* runQuery(() => {
      return db
        .select({ config: agentTool.config, toolId: agentTool.toolId })
        .from(agentTool)
        .where(eq(agentTool.agentId, agentId));
    });

    return { ...row, tools };
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

    yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: async () => {
        await db.insert(agent).values({
          defaultModelId: input.defaultModelId,
          description: input.description,
          id,
          name: input.name,
          systemPrompt: input.systemPrompt,
          userId,
        });

        if (input.tools.length > 0) {
          await db.insert(agentTool).values(
            input.tools.map((tool) => {
              return { agentId: id, config: tool.config, toolId: tool.toolId };
            }),
          );
        }
      },
    });

    return { id };
  });
};

export const updateAgent = (agentId: string, input: AgentInput) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: async () => {
        await db
          .update(agent)
          .set({
            defaultModelId: input.defaultModelId,
            description: input.description,
            name: input.name,
            systemPrompt: input.systemPrompt,
          })
          .where(eq(agent.id, agentId));

        await db.delete(agentTool).where(eq(agentTool.agentId, agentId));

        if (input.tools.length > 0) {
          await db.insert(agentTool).values(
            input.tools.map((tool) => {
              return { agentId, config: tool.config, toolId: tool.toolId };
            }),
          );
        }
      },
    });
  });
};

export const deleteAgent = (agentId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: async () => {
        await db.delete(conversation).where(eq(conversation.agentId, agentId));
        await db.delete(agent).where(eq(agent.id, agentId));
      },
    });
  });
};
