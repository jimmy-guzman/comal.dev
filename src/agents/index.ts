import type { Tool } from "ai";

import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { agent, agentTool } from "@/db/schemas/agent-schema";
import { Database } from "@/db/service";
import { DatabaseError, NotFoundError } from "@/lib/errors";

import type { AgentConfig } from "./types";

import { tools as toolRegistry } from "./tools/registry";

const buildToolsRecord = (rows: { config: unknown; toolId: string }[]) => {
  return Effect.gen(function* () {
    const result: Record<string, Tool> = {};

    for (const row of rows) {
      const def = toolRegistry.get(row.toolId);

      if (!def) {
        yield* Effect.logWarning(`unknown tool id "${row.toolId}", skipping`);
        continue;
      }

      const validation = def.configSchema["~standard"].validate(row.config);

      if (validation instanceof Promise) {
        yield* Effect.logWarning(`async config validation not supported for "${row.toolId}"`);
        continue;
      }

      if (validation.issues) {
        yield* Effect.logWarning(
          `invalid config for "${row.toolId}", falling back to default`,
        ).pipe(Effect.annotateLogs({ issues: validation.issues }));
        result[row.toolId] = def.build(def.defaultConfig);
        continue;
      }

      result[row.toolId] = def.build(validation.value);
    }

    return result;
  });
};

export const loadAgent = (agentId: string, userId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select({
            defaultModelId: agent.defaultModelId,
            description: agent.description,
            id: agent.id,
            name: agent.name,
            systemPrompt: agent.systemPrompt,
          })
          .from(agent)
          .where(and(eq(agent.id, agentId), eq(agent.userId, userId)))
          .limit(1);
      },
    });

    const row = rows.at(0);

    if (!row) {
      return yield* Effect.fail(new NotFoundError({ resource: "agent" }));
    }

    const toolRows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select({ config: agentTool.config, toolId: agentTool.toolId })
          .from(agentTool)
          .where(eq(agentTool.agentId, agentId));
      },
    });

    const toolsRecord = yield* buildToolsRecord(toolRows);

    return {
      defaultModelId: row.defaultModelId,
      description: row.description ?? "",
      id: row.id,
      name: row.name,
      systemPrompt: row.systemPrompt,
      tools: toolsRecord,
    } satisfies AgentConfig;
  }).pipe(Effect.withLogSpan("loadAgent"), Effect.annotateLogs({ agentId, userId }));
};
