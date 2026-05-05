import type { Tool, ToolSet } from "ai";

import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { agent, agentSubagent, agentTool } from "@/db/schemas/agent-schema";
import { Database, runQuery } from "@/db/service";
import { NotFoundError } from "@/lib/errors";
import { SUBAGENT_PREFIX } from "@/lib/subagent-prefix";

import type { ToolContext } from "./tools/types";
import type { AgentConfig } from "./types";

import { buildSubagentTool } from "./subagent";
import { buildTool } from "./tools/build";
import { tools as toolRegistry } from "./tools/registry";

const MAX_DEPTH = 1;

const stripApprovalConfig = (config: unknown): unknown => {
  if (typeof config === "object" && config !== null && "needsApproval" in config) {
    return { ...(config as Record<string, unknown>), needsApproval: false };
  }

  return config;
};

const buildToolsRecord = (
  rows: { config: unknown; toolId: string }[],
  depth: number,
  context: ToolContext,
) => {
  return Effect.gen(function* () {
    const result: ToolSet = {};

    for (const row of rows) {
      const def = toolRegistry.get(row.toolId);

      if (!def) {
        yield* Effect.logWarning(`unknown tool id "${row.toolId}", skipping`);
        continue;
      }

      const rawConfig = depth > 0 ? stripApprovalConfig(row.config) : row.config;
      const validation = def.configSchema["~standard"].validate(rawConfig);

      if (validation instanceof Promise) {
        yield* Effect.logWarning(`async config validation not supported for "${row.toolId}"`);
        continue;
      }

      let config: unknown;

      if (validation.issues) {
        yield* Effect.logWarning(
          `invalid config for "${row.toolId}", falling back to default`,
        ).pipe(Effect.annotateLogs({ issues: validation.issues }));
        config = depth > 0 ? stripApprovalConfig(def.defaultConfig) : def.defaultConfig;
      } else {
        config = validation.value;
      }

      const built = buildTool(row.toolId, config, context);

      if (!built) {
        yield* Effect.logWarning(`no builder registered for "${row.toolId}", skipping`);
        continue;
      }

      result[row.toolId] = built;
    }

    return result;
  });
};

const loadSubagentTools = (parentId: string, ownerId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* runQuery(() => {
      return db
        .select({
          alias: agentSubagent.alias,
          childAgentId: agentSubagent.childAgentId,
          childDescription: agent.description,
          childName: agent.name,
          descriptionOverride: agentSubagent.descriptionOverride,
        })
        .from(agentSubagent)
        .innerJoin(agent, eq(agent.id, agentSubagent.childAgentId))
        .where(eq(agentSubagent.parentAgentId, parentId));
    });

    const result: Record<string, Tool> = {};

    for (const row of rows) {
      result[`${SUBAGENT_PREFIX}${row.alias}`] = buildSubagentTool({
        childDescription: row.childDescription ?? "",
        childName: row.childName,
        link: {
          alias: row.alias,
          childAgentId: row.childAgentId,
          descriptionOverride: row.descriptionOverride,
        },
        ownerId,
      });
    }

    return result;
  });
};

export const loadAgent = (agentId: string, userId: string, depth = 0) => {
  return Effect.gen(function* () {
    if (depth > MAX_DEPTH) {
      return yield* Effect.die(`loadAgent depth ${depth} exceeds max ${MAX_DEPTH}`);
    }

    const db = yield* Database;

    const rows = yield* runQuery(() => {
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
    });

    const row = rows.at(0);

    if (!row) {
      return yield* Effect.fail(new NotFoundError({ resource: "agent" }));
    }

    const toolRows = yield* runQuery(() => {
      return db
        .select({ config: agentTool.config, toolId: agentTool.toolId })
        .from(agentTool)
        .where(eq(agentTool.agentId, agentId));
    });

    const toolContext: ToolContext = { userId };
    const toolsRecord = yield* buildToolsRecord(toolRows, depth, toolContext);

    const subagentTools =
      depth === 0 ? yield* loadSubagentTools(agentId, userId) : ({} satisfies ToolSet);

    return {
      defaultModelId: row.defaultModelId,
      description: row.description ?? "",
      id: row.id,
      name: row.name,
      systemPrompt: row.systemPrompt,
      tools: { ...toolsRecord, ...subagentTools },
    } satisfies AgentConfig;
  }).pipe(Effect.withLogSpan("loadAgent"), Effect.annotateLogs({ agentId, depth, userId }));
};
