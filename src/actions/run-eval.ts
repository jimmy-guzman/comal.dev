"use server";

import { generateText } from "ai";
import { Effect, Exit } from "effect";
import { nanoid } from "nanoid";
import { z } from "zod";

import type { StringScorer } from "@/lib/eval-scorer";

import { loadAgent } from "@/agents";
import { appRuntime } from "@/db/service";
import { LLMError, NotFoundError } from "@/lib/errors";
import { scoreEval, scoreEvalLLM } from "@/lib/eval-scorer";
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

      const runOnce = () => {
        return Effect.tryPromise({
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
      };

      if (evalRow.scorer === "llm-judge") {
        const result = yield* runOnce();
        const output = result.text;

        const judgment = yield* Effect.tryPromise({
          catch: (cause) => new LLMError({ cause }),
          try: () => {
            return scoreEvalLLM(evalRow.input, output, evalRow.expected ?? undefined);
          },
        });

        yield* createEvalRun({
          agentVersionId: agentConfig.versionId,
          evalId: parsedInput.evalId,
          output,
          rationale: judgment.rationale,
          score: judgment.score,
        });

        return { output, rationale: judgment.rationale, score: judgment.score };
      }

      const stringScorer = evalRow.scorer as StringScorer;
      const expected = evalRow.expected ?? "";
      const trials = Math.max(1, evalRow.trials);
      const runGroupId = trials > 1 ? nanoid() : null;

      const trialResults: { id: string; output: string; score: number }[] = [];

      for (let i = 0; i < trials; i++) {
        const result = yield* runOnce();
        const output = result.text;
        const score = scoreEval(stringScorer, output, expected);
        const id = nanoid();

        trialResults.push({ id, output, score });

        yield* createEvalRun({
          agentVersionId: agentConfig.versionId,
          evalId: parsedInput.evalId,
          id,
          output,
          runGroupId,
          score,
        });
      }

      const scores = trialResults.map((trial) => trial.score);
      const sum = scores.reduce((acc, value) => acc + value, 0);
      const mean = sum / scores.length;

      if (trials === 1) {
        return { output: trialResults[0]?.output ?? "", score: trialResults[0]?.score ?? 0 };
      }

      return {
        aggregate: {
          count: trialResults.length,
          max: Math.max(...scores),
          mean,
          min: Math.min(...scores),
          trials: trialResults,
        },
        output: trialResults[0]?.output ?? "",
        score: mean,
      };
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
