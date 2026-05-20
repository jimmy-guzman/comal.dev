import { generateText, stepCountIs, tool } from "ai";
import { Effect, Exit } from "effect";
import { nanoid } from "nanoid";
import { z } from "zod";

import { loadAgent } from "@/agents";
import { appRuntime } from "@/db/service";
import { LLMError, ValidationError } from "@/lib/errors";
import { isStringScorer, scoreEval, scoreEvalLLM } from "@/lib/eval-scorer";
import { createEvalRun, createEvalRuns, getEvalWithOwnership } from "@/lib/evals";
import { openrouter } from "@/lib/openrouter";

import type { ToolContext } from "../types";

const MAX_OUTPUT_TOKENS = 2048;

export const buildEvalsRun = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Run a single eval against the agent's current configuration. Returns the score, the agent's output, and (for llm-judge) the rationale; multi-trial string scorers also return an aggregate. This is the complete record of the run. Eval runs are not saved as traces, so debug failures from the returned output and rationale.",
    execute: async ({ evalId }) => {
      const program = Effect.gen(function* () {
        const evalRow = yield* getEvalWithOwnership(evalId, context.userId);
        const agentConfig = yield* loadAgent(evalRow.agentId, context.userId);

        const runOnce = () => {
          return Effect.tryPromise({
            catch: (cause) => {
              return new LLMError({
                cause,
                message: cause instanceof Error ? cause.message : String(cause),
              });
            },
            try: () => {
              return generateText({
                maxOutputTokens: MAX_OUTPUT_TOKENS,
                messages: [{ content: evalRow.input, role: "user" }],
                model: openrouter(agentConfig.defaultModelId),
                stopWhen: stepCountIs(8),
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
            catch: (cause) => {
              return new LLMError({
                cause,
                message: cause instanceof Error ? cause.message : String(cause),
              });
            },
            try: () => {
              return scoreEvalLLM(evalRow.input, output, evalRow.expected ?? undefined);
            },
          });

          yield* createEvalRun({
            agentVersionId: agentConfig.versionId,
            evalId,
            output,
            rationale: judgment.rationale,
            score: judgment.score,
          });

          return { output, rationale: judgment.rationale, score: judgment.score };
        }

        if (!isStringScorer(evalRow.scorer)) {
          return yield* Effect.fail(
            new ValidationError({
              message: `Eval "${evalRow.name}" has unknown scorer "${evalRow.scorer}".`,
            }),
          );
        }

        if (!evalRow.expected) {
          return yield* Effect.fail(
            new ValidationError({
              message: `Eval "${evalRow.name}" uses scorer "${evalRow.scorer}" but has no expected output.`,
            }),
          );
        }

        const stringScorer = evalRow.scorer;
        const { expected } = evalRow;
        const trials = Math.max(1, evalRow.trials);
        const runGroupId = trials > 1 ? nanoid() : null;

        const trialResults: { id: string; output: string; score: number }[] = [];

        for (let i = 0; i < trials; i++) {
          const result = yield* runOnce();
          const output = result.text;
          const score = scoreEval(stringScorer, output, expected);

          trialResults.push({ id: nanoid(), output, score });
        }

        yield* createEvalRuns(
          trialResults.map((trial) => {
            return {
              agentVersionId: agentConfig.versionId,
              evalId,
              id: trial.id,
              output: trial.output,
              runGroupId,
              score: trial.score,
            };
          }),
        );

        const scores = trialResults.map((trial) => trial.score);
        const mean = scores.reduce((acc, value) => acc + value, 0) / scores.length;

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
