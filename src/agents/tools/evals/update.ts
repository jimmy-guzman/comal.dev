import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { appRuntime } from "@/db/service";
import { updateAgent } from "@/lib/agents";
import { evalEntrySchema, SCORER_OPTIONS, toolCallAssertionSchema } from "@/lib/eval-input-schema";
import { getEvalWithOwnership } from "@/lib/evals";

import type { ToolContext } from "../types";

export const buildEvalsUpdate = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Update one or more fields on an existing eval. Only the provided fields change. For text scorers, provide expected; for the tool-call scorer, provide assertion ({ mustCall?, mustNotCall?, mustCallWithArgs? }). Snapshots a new agent version.",
    execute: async ({ assertion, evalId, expected, input, name, scorer, trials }) => {
      if (
        assertion === undefined &&
        expected === undefined &&
        input === undefined &&
        name === undefined &&
        scorer === undefined &&
        trials === undefined
      ) {
        return { error: "Provide at least one field to update." };
      }

      const existingExit = await appRuntime.runPromiseExit(
        getEvalWithOwnership(evalId, context.userId),
      );

      if (Exit.isFailure(existingExit)) {
        return { error: "Eval not found or not owned by you." };
      }

      const existing = existingExit.value;
      const { agentId } = existing;

      const parsed = evalEntrySchema.safeParse({
        assertion: assertion ?? existing.assertion ?? undefined,
        expected: expected ?? existing.expected ?? undefined,
        id: evalId,
        input: input ?? existing.input,
        name: name ?? existing.name,
        scorer: scorer ?? (existing.scorer as Scorer),
        trials: trials ?? existing.trials,
      });

      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid eval after update." };
      }

      const overrides = {
        ...(assertion === undefined ? {} : { assertion }),
        ...(expected === undefined ? {} : { expected }),
        ...(input === undefined ? {} : { input }),
        ...(name === undefined ? {} : { name }),
        ...(scorer === undefined ? {} : { scorer }),
        ...(trials === undefined ? {} : { trials }),
      };

      const patchOutcome = { evalMissing: false };

      const exit = await appRuntime.runPromiseExit(
        updateAgent(agentId, context.userId, (current) => {
          const target = current.evals.find((e) => e.id === evalId);

          if (!target) {
            patchOutcome.evalMissing = true;

            return current;
          }

          const merged = { ...target, ...overrides };
          const isToolCall = merged.scorer === "tool-call";
          const nextEval = {
            ...merged,
            assertion: isToolCall ? merged.assertion : undefined,
            expected: isToolCall ? undefined : merged.expected,
            trials: merged.scorer === "llm-judge" || isToolCall ? 1 : merged.trials,
          };

          return {
            ...current,
            evals: current.evals.map((e) => (e.id === evalId ? nextEval : e)),
          };
        }),
      );

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (
          cause._tag === "Fail" &&
          (cause.error._tag === "NotFoundError" || cause.error._tag === "ForbiddenError")
        ) {
          return { error: "Agent not found, not owned by you, or a system agent." };
        }

        return { error: "Failed to update eval." };
      }

      if (patchOutcome.evalMissing) {
        return { error: "Eval not found or not owned by you." };
      }

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, evalId };
    },
    inputSchema: z.object({
      assertion: toolCallAssertionSchema
        .optional()
        .describe("New tool-call assertion. Set only when the eval's scorer is tool-call."),
      evalId: z.string().min(1).describe("The ID of the eval to update."),
      expected: z.string().min(1).max(10_000).optional().describe("New expected output."),
      input: z.string().min(1).max(10_000).optional().describe("New input prompt."),
      name: z.string().min(1).max(200).optional().describe("New eval name."),
      scorer: z.enum(SCORER_OPTIONS).optional().describe("New scorer type."),
      trials: z.number().int().min(1).max(10).optional().describe("New trial count (1-10)."),
    }),
  });
};
