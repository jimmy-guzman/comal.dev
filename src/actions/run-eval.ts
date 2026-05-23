"use server";

import { Cause, Exit } from "effect";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { EvalRunnerService } from "@/lib/eval-runner";
import { authClient } from "@/lib/safe-action";

export const runEvalAction = authClient
  .inputSchema(z.object({ evalId: z.string().min(1) }))
  .action(async ({ ctx, parsedInput }) => {
    const exit = await appRuntime.runPromiseExit(
      EvalRunnerService.runEval(parsedInput.evalId, ctx.auth.user.id),
    );

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail") {
        if (cause.error._tag === "EvalNotFoundError" || cause.error._tag === "AgentNotFoundError") {
          throw cause.error;
        }

        if (cause.error._tag === "ValidationError" || cause.error._tag === "LLMError") {
          throw new Error(cause.error.message);
        }
      }

      throw new Error(`Failed to run eval: ${Cause.pretty(cause)}`);
    }

    return exit.value;
  });
