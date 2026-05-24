import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";

import type { ToolContext } from "../types";

export const buildAgentsUpdateSuggestions = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Replaces the starter suggestions on an agent. Pass the full new list; the existing list is overwritten. Use an empty array to clear. Up to 8 suggestions, 100 characters each. System agents cannot be updated.",
    execute: async ({ agentId, suggestions }) => {
      const exit = await appRuntime.runPromiseExit(
        AgentService.updateSuggestions(agentId, context.userId, suggestions),
      );

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (
          cause._tag === "Fail" &&
          (cause.error._tag === "AgentNotFoundError" || cause.error._tag === "ForbiddenError")
        ) {
          return { error: "Agent not found, not owned by you, or a system agent." };
        }

        return { error: "Failed to update suggestions." };
      }

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, suggestions };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent to update."),
      suggestions: z
        .array(z.string().trim().min(1).max(100))
        .max(8)
        .describe("The full list of starter suggestions to set. Replaces any existing list."),
    }),
  });
};
