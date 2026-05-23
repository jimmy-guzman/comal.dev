"use server";

import { z } from "zod";

import { AgentNotFoundError } from "@/lib/errors";
import { runEvalSuite } from "@/lib/eval-runner";
import { authClient } from "@/lib/safe-action";

export const runEvalSuiteAction = authClient
  .inputSchema(z.object({ agentId: z.string().min(1) }))
  .action(async ({ ctx, parsedInput }) => {
    try {
      return await runEvalSuite(parsedInput.agentId, ctx.auth.user.id);
    } catch (error) {
      if (error instanceof AgentNotFoundError) throw error;

      throw new Error("Failed to run evals.", { cause: error });
    }
  });
