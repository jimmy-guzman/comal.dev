import { Effect } from "effect";
import { isEqual } from "es-toolkit";

import type { agentSubagent, agentTool, agentVersion } from "@/db/schemas/agent-schema";
import type { Database } from "@/db/service";
import type { DatabaseError, NotFoundError } from "@/lib/errors";

import { getAgentVersion } from "@/lib/agents";

type EvalEntry = VersionRow["evals"][number];
type IdentifiedEvalEntry = EvalEntry & { id: string };
type SubAgentEntry = Pick<
  typeof agentSubagent.$inferSelect,
  "alias" | "childAgentId" | "descriptionOverride"
>;
type ToolEntry = Pick<typeof agentTool.$inferSelect, "config" | "toolId">;
type VersionRow = typeof agentVersion.$inferSelect;

interface ToolDiff {
  added: ToolEntry[];
  changed: { configAfter: unknown; configBefore: unknown; toolId: string }[];
  removed: ToolEntry[];
}

interface SubAgentDiff {
  added: SubAgentEntry[];
  changed: { after: SubAgentEntry; before: SubAgentEntry; childAgentId: string }[];
  removed: SubAgentEntry[];
}

interface EvalDiff {
  added: IdentifiedEvalEntry[];
  changed: { after: IdentifiedEvalEntry; before: IdentifiedEvalEntry; id: string }[];
  removed: IdentifiedEvalEntry[];
}

export interface AgentVersionDiff {
  changes: {
    evals: EvalDiff;
    modelId?: { after: string; before: string };
    subAgents: SubAgentDiff;
    systemPrompt?: { after: string; before: string; charDelta: number };
    tools: ToolDiff;
  };
  versionA: { createdAt: Date; id: string };
  versionB: { createdAt: Date; id: string };
}

const diffTools = (a: ToolEntry[], b: ToolEntry[]): ToolDiff => {
  const aMap = new Map(a.map((entry) => [entry.toolId, entry]));
  const bMap = new Map(b.map((entry) => [entry.toolId, entry]));

  return {
    added: [...bMap.entries()].flatMap(([toolId, entry]) => {
      return aMap.has(toolId) ? [] : [entry];
    }),
    changed: [...bMap.entries()].flatMap(([toolId, bEntry]) => {
      const aEntry = aMap.get(toolId);

      if (aEntry === undefined) return [];

      if (isEqual(aEntry.config, bEntry.config)) return [];

      return [{ configAfter: bEntry.config, configBefore: aEntry.config, toolId }];
    }),
    removed: [...aMap.entries()].flatMap(([toolId, entry]) => {
      return bMap.has(toolId) ? [] : [entry];
    }),
  };
};

const diffSubAgents = (a: SubAgentEntry[], b: SubAgentEntry[]): SubAgentDiff => {
  const aMap = new Map(a.map((entry) => [entry.childAgentId, entry]));
  const bMap = new Map(b.map((entry) => [entry.childAgentId, entry]));

  return {
    added: [...bMap.entries()].flatMap(([childAgentId, entry]) => {
      return aMap.has(childAgentId) ? [] : [entry];
    }),
    changed: [...bMap.entries()].flatMap(([childAgentId, bEntry]) => {
      const aEntry = aMap.get(childAgentId);

      if (aEntry === undefined) return [];

      if (
        aEntry.alias === bEntry.alias &&
        aEntry.descriptionOverride === bEntry.descriptionOverride
      ) {
        return [];
      }

      return [{ after: bEntry, before: aEntry, childAgentId }];
    }),
    removed: [...aMap.entries()].flatMap(([childAgentId, entry]) => {
      return bMap.has(childAgentId) ? [] : [entry];
    }),
  };
};

const withId = (entries: EvalEntry[]): IdentifiedEvalEntry[] => {
  return entries.flatMap((entry) => {
    return entry.id === undefined ? [] : [{ ...entry, id: entry.id }];
  });
};

const diffEvals = (a: EvalEntry[], b: EvalEntry[]): EvalDiff => {
  const aIdentified = withId(a);
  const bIdentified = withId(b);
  const aMap = new Map(aIdentified.map((entry) => [entry.id, entry]));
  const bMap = new Map(bIdentified.map((entry) => [entry.id, entry]));

  return {
    added: [...bMap.entries()].flatMap(([id, entry]) => {
      return aMap.has(id) ? [] : [entry];
    }),
    changed: [...bMap.entries()].flatMap(([id, bEntry]) => {
      const aEntry = aMap.get(id);

      if (aEntry === undefined) return [];

      if (isEqual(aEntry, bEntry)) return [];

      return [{ after: bEntry, before: aEntry, id }];
    }),
    removed: [...aMap.entries()].flatMap(([id, entry]) => {
      return bMap.has(id) ? [] : [entry];
    }),
  };
};

const computeDiff = (a: VersionRow, b: VersionRow): AgentVersionDiff => {
  return {
    changes: {
      evals: diffEvals(a.evals, b.evals),
      ...(a.modelId === b.modelId ? {} : { modelId: { after: b.modelId, before: a.modelId } }),
      subAgents: diffSubAgents(a.subAgents, b.subAgents),
      ...(a.systemPrompt === b.systemPrompt
        ? {}
        : {
            systemPrompt: {
              after: b.systemPrompt,
              before: a.systemPrompt,
              charDelta: b.systemPrompt.length - a.systemPrompt.length,
            },
          }),
      tools: diffTools(a.tools, b.tools),
    },
    versionA: { createdAt: a.createdAt, id: a.id },
    versionB: { createdAt: b.createdAt, id: b.id },
  };
};

export const diffAgentVersions = (
  agentId: string,
  versionAId: string,
  versionBId: string,
  userId: string,
): Effect.Effect<AgentVersionDiff, DatabaseError | NotFoundError, Database> => {
  return Effect.gen(function* () {
    const [a, b] = yield* Effect.all(
      [getAgentVersion(versionAId, agentId, userId), getAgentVersion(versionBId, agentId, userId)],
      { concurrency: "unbounded" },
    );

    return computeDiff(a, b);
  });
};
