import { stepCountIs, streamText } from "ai";
import { Cause, Effect, Exit, Option } from "effect";
import { Semaphore } from "es-toolkit";
import { nanoid } from "nanoid";

import type { ChatStreamContext } from "@/lib/chat/stream-context";
import type {
  AgentNotFoundError as AgentNotFoundErrorType,
  DatabaseError,
  EvalNotFoundError,
} from "@/lib/errors";
import type { EvalRunTrial } from "@/lib/evals";

import { loadAgent } from "@/agents";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { ChatService } from "@/lib/chat";
import { persistChatStream } from "@/lib/chat/persist-stream";
import { ChatStoreService } from "@/lib/chat/store";
import { AgentNotFoundError, LLMError, ValidationError } from "@/lib/errors";
import { toolCallAssertionSchema } from "@/lib/eval-input-schema";
import { isStringScorer, scoreEval, scoreEvalLLM, scoreToolCall } from "@/lib/eval-scorer";
import { EvalService } from "@/lib/evals";
import { openrouterForUser } from "@/lib/openrouter";

const MAX_OUTPUT_TOKENS = 2048;

const SUITE_CONCURRENCY = 3;

export class EvalRunnerService extends Effect.Service<EvalRunnerService>()("EvalRunnerService", {
  accessors: true,
  dependencies: [
    AgentService.Default,
    ChatService.Default,
    ChatStoreService.Default,
    EvalService.Default,
  ],
  effect: Effect.gen(function* () {
    yield* Effect.void;
    const runEval = Effect.fn("EvalRunnerService.runEval")(function* (
      evalId: string,
      userId: string,
      suiteRunId: null | string = null,
    ) {
      yield* Effect.annotateCurrentSpan("evalId", evalId);
      yield* Effect.annotateCurrentSpan("userId", userId);

      const evalRow = yield* EvalService.getWithOwnership(evalId, userId);
      const agentConfig = yield* loadAgent(evalRow.agentId, userId, { sandbox: true });

      const runTrial = Effect.fn("EvalRunnerService.runTrial")(function* () {
        const { id: conversationId } = yield* ChatService.createWithFirstUserMessage({
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

        const openrouter = yield* openrouterForUser(userId);

        const output = yield* Effect.tryPromise({
          catch: (cause) => {
            return new LLMError({
              cause: cause instanceof Error ? cause.message : String(cause),
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
                void appRuntime.runPromise(Effect.logError("eval streamText error", error));
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
                void appRuntime.runPromise(
                  Effect.logError("eval persistChatStream event error", error),
                );
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

      if (evalRow.scorer === "llm-judge") {
        const trial = yield* runTrial();

        const judgment = yield* Effect.tryPromise({
          catch: (cause) => {
            return new LLMError({
              cause: cause instanceof Error ? cause.message : String(cause),
              message: cause instanceof Error ? cause.message : String(cause),
            });
          },
          try: () => {
            return scoreEvalLLM(evalRow.input, trial.output, evalRow.expected ?? undefined);
          },
        });

        yield* EvalService.createRun({
          agentVersionId: agentConfig.versionId,
          conversationId: trial.conversationId,
          evalId,
          output: trial.output,
          rationale: judgment.rationale,
          score: judgment.score,
          suiteRunId,
        });

        return {
          conversationId: trial.conversationId,
          output: trial.output,
          rationale: judgment.rationale,
          score: judgment.score,
        };
      }

      if (evalRow.scorer === "tool-call") {
        const parsedAssertion = toolCallAssertionSchema.safeParse(evalRow.assertion);

        if (!parsedAssertion.success) {
          return yield* Effect.fail(
            new ValidationError({
              message: `Eval "${evalRow.name}" has an invalid tool-call assertion.`,
            }),
          );
        }

        const trial = yield* runTrial();
        const calls = yield* ChatStoreService.getConversationToolCalls(trial.conversationId);
        const { rationale, score } = scoreToolCall(parsedAssertion.data, calls);

        yield* EvalService.createRun({
          agentVersionId: agentConfig.versionId,
          conversationId: trial.conversationId,
          evalId,
          output: trial.output,
          rationale,
          score,
          suiteRunId,
        });

        return {
          conversationId: trial.conversationId,
          output: trial.output,
          rationale,
          score,
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

      yield* EvalService.createRuns(
        outcomes.map((outcome) => {
          return {
            agentVersionId: agentConfig.versionId,
            conversationId: outcome.conversationId,
            evalId,
            id: outcome.id,
            output: outcome.output,
            runGroupId,
            score: outcome.score,
            suiteRunId,
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

    return { runEval };
  }),
}) {}

type RunEvalError =
  | AgentNotFoundErrorType
  | DatabaseError
  | EvalNotFoundError
  | LLMError
  | ValidationError;
type RunEvalOutcome = Effect.Effect.Success<ReturnType<typeof EvalRunnerService.runEval>>;

type SuiteEvalResult =
  | (RunEvalOutcome & { evalId: string; name: string })
  | { error: string; evalId: string; name: string };

const failureMessage = (cause: Cause.Cause<RunEvalError>) => {
  const failure = Cause.failureOption(cause);

  if (Option.isNone(failure)) return "The eval failed to run.";

  const error = failure.value;

  if (error._tag === "AgentNotFoundError" || error._tag === "EvalNotFoundError") {
    return "Eval or agent not found.";
  }

  if (error._tag === "ValidationError" || error._tag === "LLMError") return error.message;

  return "The eval failed to run.";
};

/**
 * Runs every eval an agent owns, capped at {@link SUITE_CONCURRENCY} in flight by
 * an es-toolkit `Semaphore`. Each eval goes through {@link EvalRunnerService.runEval},
 * so it gets its own traced `kind="eval"` conversation. One failing eval never
 * fails the suite: its result entry carries an `error` instead. `suiteRunId` is
 * minted per invocation and written onto every run row, so a suite run's total
 * cost is queryable.
 */
export const runEvalSuite = async (
  agentId: string,
  userId: string,
): Promise<{ results: SuiteEvalResult[]; suiteRunId: string }> => {
  const loaded = await appRuntime.runPromiseExit(AgentService.getForUser(agentId, userId));

  if (Exit.isFailure(loaded)) {
    const failure = Cause.failureOption(loaded.cause);

    if (Option.isSome(failure)) {
      if (failure.value._tag === "AgentNotFoundError") {
        throw new AgentNotFoundError({ agentId, message: "Agent not found for eval suite." });
      }

      throw failure.value;
    }

    throw new Error("Failed to load the agent for the eval suite.");
  }

  const suiteRunId = nanoid();
  const gate = new Semaphore(SUITE_CONCURRENCY);

  const results = await Promise.all(
    loaded.value.evals.map(async (evalRow): Promise<SuiteEvalResult> => {
      await gate.acquire();

      try {
        const exit = await appRuntime.runPromiseExit(
          EvalRunnerService.runEval(evalRow.id, userId, suiteRunId),
        );

        if (Exit.isSuccess(exit)) {
          return { evalId: evalRow.id, name: evalRow.name, ...exit.value };
        }

        return { error: failureMessage(exit.cause), evalId: evalRow.id, name: evalRow.name };
      } finally {
        gate.release();
      }
    }),
  );

  return { results, suiteRunId };
};
