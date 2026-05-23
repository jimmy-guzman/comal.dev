import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";

import type { ToolContext } from "../types";

export const buildAgentsDelete = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Deletes an agent owned by the current user. System agents cannot be deleted. This action is irreversible.",
    execute: async ({ agentId }) => {
      const ownershipExit = await appRuntime.runPromiseExit(
        AgentService.assertOwnership(agentId, context.userId),
      );

      if (Exit.isFailure(ownershipExit)) {
        return { error: "Agent not found or not owned by you." };
      }

      const agentExit = await appRuntime.runPromiseExit(
        AgentService.getForUser(agentId, context.userId),
      );

      if (Exit.isFailure(agentExit)) {
        return { error: "Agent not found." };
      }

      if (agentExit.value.isSystem) {
        return { error: "System agents cannot be deleted." };
      }

      const deleteExit = await appRuntime.runPromiseExit(AgentService.delete(agentId));

      if (Exit.isFailure(deleteExit)) {
        return { error: "Failed to delete agent." };
      }

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, deleted: true };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent to delete."),
    }),
  });
};
