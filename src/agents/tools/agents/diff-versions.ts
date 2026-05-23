import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { diffAgentVersions } from "@/lib/agent-version-diff";

import type { ToolContext } from "../types";

export const buildAgentsDiffVersions = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Compare two version snapshots of an agent. Returns a field-level diff of the model, system prompt, tools, sub-agents, and evals. Treat version A as the baseline and version B as the comparison.",
    execute: async ({ agentId, versionAId, versionBId }) => {
      const exit = await appRuntime.runPromiseExit(
        diffAgentVersions(agentId, versionAId, versionBId, context.userId),
      );

      if (Exit.isFailure(exit)) {
        return { error: "One or both versions were not found for this agent." };
      }

      return exit.value;
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent."),
      versionAId: z.string().min(1).describe("The baseline version ID (before)."),
      versionBId: z.string().min(1).describe("The comparison version ID (after)."),
    }),
  });
};
