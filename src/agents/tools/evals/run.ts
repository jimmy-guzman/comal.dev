import { tool } from "ai";
import { Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { runEval } from "@/lib/eval-runner";

import type { ToolContext } from "../types";

export const buildEvalsRun = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Run a single eval against the agent's current configuration. Returns the score, the agent's output, and a conversationId; for llm-judge it also returns the rationale, and multi-trial string scorers return an aggregate. Pass the conversationId to traces-get to inspect the full per-step execution, including tool calls and sub-agent steps.",
    execute: async ({ evalId }) => {
      const exit = await appRuntime.runPromiseExit(runEval(evalId, context.userId));

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (cause._tag === "Fail") {
          if (cause.error._tag === "NotFoundError") {
            return { error: "Eval not found or not owned by you." };
          }

          if (cause.error._tag === "ValidationError" || cause.error._tag === "LLMError") {
            return { error: cause.error.message };
          }
        }

        return { error: "Failed to run eval." };
      }

      return exit.value;
    },
    inputSchema: z.object({
      evalId: z.string().min(1).describe("The ID of the eval to run."),
    }),
  });
};
