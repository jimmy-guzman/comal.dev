import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { EvalService } from "@/lib/evals";

import type { ToolContext } from "../types";

export const buildEvalsDelete = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Delete an eval from an agent. Snapshots a new agent version reflecting the removal.",
    execute: async ({ evalId }) => {
      const existingExit = await appRuntime.runPromiseExit(
        EvalService.getWithOwnership(evalId, context.userId),
      );

      if (Exit.isFailure(existingExit)) {
        return { error: "Eval not found or not owned by you." };
      }

      const { agentId } = existingExit.value;

      const exit = await appRuntime.runPromiseExit(
        AgentService.update(agentId, context.userId, (current) => {
          return {
            ...current,
            evals: current.evals.filter((e) => e.id !== evalId),
          };
        }),
      );

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (
          cause._tag === "Fail" &&
          (cause.error._tag === "AgentNotFoundError" || cause.error._tag === "ForbiddenError")
        ) {
          return { error: "Agent not found, not owned by you, or a system agent." };
        }

        return { error: "Failed to delete eval." };
      }

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, evalId };
    },
    inputSchema: z.object({
      evalId: z.string().min(1).describe("The ID of the eval to delete."),
    }),
  });
};
