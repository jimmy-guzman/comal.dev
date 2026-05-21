import { tool } from "ai";
import { z } from "zod";

import { NotFoundError } from "@/lib/errors";
import { runEvalSuite } from "@/lib/eval-runner";

import type { ToolContext } from "../types";

export const buildEvalsRunBatch = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Run every eval for an agent in one batch (up to 3 at a time) and record each run with its score. Returns a runGroupId for the batch and one result per eval: score, output, and (for llm-judge) rationale; an eval that errors carries an error message instead.",
    execute: async ({ agentId }) => {
      try {
        return await runEvalSuite(agentId, context.userId);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return { error: "Agent not found or not owned by you." };
        }

        return { error: "Failed to run the agent's evals." };
      }
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent whose evals to run."),
    }),
  });
};
