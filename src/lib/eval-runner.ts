import { stepCountIs, streamText } from "ai";
import { Cause, Effect, Exit, Option } from "effect";
import { Semaphore } from "es-toolkit";
import { nanoid } from "nanoid";

import type { ChatStreamContext } from "@/lib/chat/stream-context";
import type { EvalRunTrial } from "@/lib/evals";

import { loadAgent } from "@/agents";
import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { createConversationWithFirstUserMessage } from "@/lib/chat";
import { persistChatStream } from "@/lib/chat/persist-stream";
import { LLMError, NotFoundError, ValidationError } from "@/lib/errors";
import { isStringScorer, scoreEval, scoreEvalLLM } from "@/lib/eval-scorer";
import { createEvalRun, createEvalRuns, getEvalWithOwnership } from "@/lib/evals";
import { openrouter } from "@/lib/openrouter";

const MAX_OUTPUT_TOKENS = 2048;

const SUITE_CONCURRENCY = 3;

/**
 * Runs an eval against its agent's current configuration through the streaming
 * path. Each trial gets its own `kind="eval"` conversation: the agent runs via
 * `streamText` with `experimental_context` so sub-agent inner traces persist,
 * and the run is written to `chat_event` via `persistChatStream`. The resulting
 * `agent_eval_run` rows carry the `conversationId` of their trace.
 *
 * A mid-stream model failure is persisted as a `turn-error` event and still
 * recorded as a run (empty output, score 0) so it can be inspected. Pre-stream
 * failures (eval/agent not found, validation) surface as typed errors.
 */
export const runEval = (evalId: string, userId: string) => {
  return Effect.gen(function* () {
    const evalRow = yield* getEvalWithOwnership(evalId, userId);
    const agentConfig = yield* loadAgent(evalRow.agentId, userId);

    const runTrial = () => {
      return Effect.gen(function* () {
        const { id: conversationId } = yield* createConversationWithFirstUserMessage({
          agentId: evalRow.agentId,
          agentVersionId: agentConfig.versionId,
          kind: "eval",
          modelId: agentConfig.defaultModelId,
          title: `eval: ${evalRow.name}`,
          userId,
          userMessage: {
            id: nanoid(),
            parts: [{ text: evalRow.input, type: "text" }],
          },
        });

        const output = yield* Effect.tryPromise({
          catch: (cause) => {
            return new LLMError({
              cause,
              message: cause instanceof Error ? cause.message : String(cause),
            });
          },
          try: async () => {
            const streamContext = {
              conversationId,
              modelId: agentConfig.defaultModelId,
            } satisfies ChatStreamContext;

            const result = streamText({
              experimental_context: streamContext,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
              messages: [{ content: evalRow.input, role: "user" }],
              model: openrouter(agentConfig.defaultModelId),
              onError: ({ error }) => {
                // eslint-disable-next-line no-console -- fire-and-forget logging from non-Effect callback
                console.error("eval streamText error", error);
              },
              stopWhen: stepCountIs(8),
              system: agentConfig.systemPrompt,
              tools: agentConfig.tools,
            });

            await persistChatStream({
              conversationId,
              fullStream: result.fullStream,
              messageId: nanoid(),
              modelId: agentConfig.defaultModelId,
              onEventError: (error) => {
                // eslint-disable-next-line no-console -- fire-and-forget logging from non-Effect callback
                console.error("eval persistChatStream event error", error);
              },
            });

            try {
              return await result.text;
            } catch {
              return "";
            }
          },
        });

        return { conversationId, output };
      });
    };

    if (evalRow.scorer === "llm-judge") {
      const trial = yield* runTrial();

      const judgment = yield* Effect.tryPromise({
        catch: (cause) => {
          return new LLMError({
            cause,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        },
        try: () => {
          return scoreEvalLLM(evalRow.input, trial.output, evalRow.expected ?? undefined);
        },
      });

      yield* createEvalRun({
        agentVersionId: agentConfig.versionId,
        conversationId: trial.conversationId,
        evalId,
        output: trial.output,
        rationale: judgment.rationale,
        score: judgment.score,
      });

      return {
        conversationId: trial.conversationId,
        output: trial.output,
        rationale: judgment.rationale,
        score: judgment.score,
      };
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

    const outcomes: EvalRunTrial[] = [];

    for (let i = 0; i < trials; i++) {
      const trial = yield* runTrial();

      outcomes.push({
        conversationId: trial.conversationId,
        id: nanoid(),
        output: trial.output,
        score: scoreEval(stringScorer, trial.output, expected),
      });
    }

    yield* createEvalRuns(
      outcomes.map((outcome) => {
        return {
          agentVersionId: agentConfig.versionId,
          conversationId: outcome.conversationId,
          evalId,
          id: outcome.id,
          output: outcome.output,
          runGroupId,
          score: outcome.score,
        };
      }),
    );

    const scores = outcomes.map((outcome) => outcome.score);
    const mean = scores.reduce((acc, value) => acc + value, 0) / scores.length;
    const first = outcomes[0];

    if (trials === 1) {
      return {
        conversationId: first.conversationId ?? "",
        output: first.output,
        score: first.score,
      };
    }

    return {
      aggregate: {
        count: outcomes.length,
        max: Math.max(...scores),
        mean,
        min: Math.min(...scores),
        trials: outcomes,
      },
      conversationId: first.conversationId ?? "",
      output: first.output,
      score: mean,
    };
  });
};

type RunEvalError = Effect.Effect.Error<ReturnType<typeof runEval>>;
type RunEvalOutcome = Effect.Effect.Success<ReturnType<typeof runEval>>;

type SuiteEvalResult =
  | (RunEvalOutcome & { evalId: string; name: string })
  | { error: string; evalId: string; name: string };

const failureMessage = (cause: Cause.Cause<RunEvalError>) => {
  const failure = Cause.failureOption(cause);

  if (Option.isNone(failure)) return "The eval failed to run.";

  const error = failure.value;

  if (error._tag === "NotFoundError") return "Eval or agent not found.";

  if (error._tag === "ValidationError" || error._tag === "LLMError") return error.message;

  return "The eval failed to run.";
};

/**
 * Runs every eval an agent owns, capped at {@link SUITE_CONCURRENCY} in flight by
 * an es-toolkit `Semaphore`. Each eval goes through {@link runEval}, so it gets
 * its own traced `kind="eval"` conversation. One failing eval never fails the
 * suite: its result entry carries an `error` instead. `runGroupId` is a
 * correlation handle for the invocation and is not written onto the run rows.
 */
export const runEvalSuite = async (
  agentId: string,
  userId: string,
): Promise<{ results: SuiteEvalResult[]; runGroupId: string }> => {
  const loaded = await appRuntime.runPromiseExit(getAgentForUser(agentId, userId));

  if (Exit.isFailure(loaded)) {
    const failure = Cause.failureOption(loaded.cause);

    if (Option.isSome(failure) && failure.value._tag === "NotFoundError") {
      throw new NotFoundError({ resource: "agent" });
    }

    throw new Error("Failed to load the agent for the eval suite.");
  }

  const runGroupId = nanoid();
  const gate = new Semaphore(SUITE_CONCURRENCY);

  const results = await Promise.all(
    loaded.value.evals.map(async (evalRow): Promise<SuiteEvalResult> => {
      await gate.acquire();

      try {
        const exit = await appRuntime.runPromiseExit(runEval(evalRow.id, userId));

        if (Exit.isSuccess(exit)) {
          return { evalId: evalRow.id, name: evalRow.name, ...exit.value };
        }

        return { error: failureMessage(exit.cause), evalId: evalRow.id, name: evalRow.name };
      } finally {
        gate.release();
      }
    }),
  );

  return { results, runGroupId };
};
