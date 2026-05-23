import { Effect } from "effect";

import type { Database } from "@/db/service";
import type { AgentNotFoundError, DatabaseError } from "@/lib/errors";

import { AgentService } from "./agents";

interface AgentExportTool {
  config: unknown;
  toolId: string;
}

interface AgentExportEval {
  expected?: string;
  input: string;
  name: string;
  scorer: string;
  trials: number;
}

interface AgentExportCycleStub {
  cycle: true;
  id: string;
  name: string;
}

interface AgentExportSubAgent {
  alias: string;
  child: AgentExportCycleStub | AgentExportNode;
  descriptionOverride?: string;
}

export interface AgentExportNode {
  defaultModelId: string;
  description?: string;
  evals: AgentExportEval[];
  id: string;
  name: string;
  subAgents: AgentExportSubAgent[];
  systemPrompt: string;
  tools: AgentExportTool[];
}

interface AgentExport {
  agent: AgentExportNode;
  exportedAt: string;
  schemaVersion: 1;
}

export type FetchedAgent = Effect.Effect.Success<ReturnType<typeof AgentService.getForUser>>;

export const walkAgentGraph = (
  agentId: string,
  fetched: ReadonlyMap<string, FetchedAgent>,
  ancestors: ReadonlyMap<string, string> = new Map(),
): AgentExportNode => {
  const agent = fetched.get(agentId);

  if (!agent) {
    throw new Error(`Agent "${agentId}" was not prefetched.`);
  }

  const nextAncestors = new Map(ancestors);

  nextAncestors.set(agentId, agent.name);

  const subAgents = agent.subAgents.map((subAgent): AgentExportSubAgent => {
    const ancestorName = nextAncestors.get(subAgent.childAgentId);

    if (ancestorName !== undefined) {
      return {
        alias: subAgent.alias,
        child: { cycle: true, id: subAgent.childAgentId, name: ancestorName },
        ...(subAgent.descriptionOverride === null
          ? {}
          : { descriptionOverride: subAgent.descriptionOverride }),
      };
    }

    return {
      alias: subAgent.alias,
      child: walkAgentGraph(subAgent.childAgentId, fetched, nextAncestors),
      ...(subAgent.descriptionOverride === null
        ? {}
        : { descriptionOverride: subAgent.descriptionOverride }),
    };
  });

  return {
    defaultModelId: agent.defaultModelId,
    ...(agent.description === null ? {} : { description: agent.description }),
    evals: agent.evals.map((evalEntry) => {
      return {
        ...(evalEntry.expected === null ? {} : { expected: evalEntry.expected }),
        input: evalEntry.input,
        name: evalEntry.name,
        scorer: evalEntry.scorer,
        trials: evalEntry.trials,
      };
    }),
    id: agent.id,
    name: agent.name,
    subAgents,
    systemPrompt: agent.systemPrompt,
    tools: agent.tools.map((tool) => {
      return { config: tool.config, toolId: tool.toolId };
    }),
  };
};

type PrefetchEffect = Effect.Effect<
  void,
  AgentNotFoundError | DatabaseError,
  AgentService | Database
>;

const prefetchReachable = (
  agentId: string,
  userId: string,
  fetched: Map<string, FetchedAgent>,
): PrefetchEffect => {
  return Effect.gen(function* () {
    if (fetched.has(agentId)) return;

    const agent = yield* AgentService.getForUser(agentId, userId);

    fetched.set(agentId, agent);

    yield* Effect.all(
      agent.subAgents.map((subAgent) => {
        return prefetchReachable(subAgent.childAgentId, userId, fetched);
      }),
      { concurrency: "unbounded" },
    );
  });
};

export const buildAgentExport = (agentId: string, userId: string) => {
  return Effect.gen(function* () {
    const fetched = new Map<string, FetchedAgent>();

    yield* prefetchReachable(agentId, userId, fetched);

    return {
      agent: walkAgentGraph(agentId, fetched),
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
    } satisfies AgentExport;
  });
};
