"use server";

import { generateText } from "ai";
import { Effect, Exit } from "effect";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { loadAgent } from "@/agents";
import { appRuntime } from "@/db/service";
import { LLMError, NotFoundError } from "@/lib/errors";
import { scoreEval } from "@/lib/eval-scorer";
import { createEvalRun, getEvalWithOwnership } from "@/lib/evals";
import { openrouter } from "@/lib/openrouter";
import { authClient } from "@/lib/safe-action";

const MAX_OUTPUT_TOKENS = 2048;

export const runEvalAction = authClient
  .inputSchema(z.object({ evalId: z.string().min(1) }))
  .action(async ({ ctx, parsedInput }) => {
    const program = Effect.gen(function* () {
      const evalRow = yield* getEvalWithOwnership(parsedInput.evalId, ctx.auth.user.id);
      const agentConfig = yield* loadAgent(evalRow.agentId, ctx.auth.user.id);

      const result = yield* Effect.tryPromise({
        catch: (cause) => new LLMError({ cause }),
        try: () => {
          return generateText({
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            messages: [{ content: evalRow.input, role: "user" }],
            model: openrouter(agentConfig.defaultModelId),
            system: agentConfig.systemPrompt,
            tools: agentConfig.tools,
          });
        },
      });

      const output = result.text;
      const score = scoreEval(evalRow.scorer as Scorer, output, evalRow.expected);

      yield* createEvalRun(parsedInput.evalId, score, output, agentConfig.versionId);

      return { output, score };
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail" && cause.error._tag === "NotFoundError") {
        throw new NotFoundError({ resource: "eval" });
      }

      throw new Error("Failed to run eval.");
    }

    return exit.value;
  });
