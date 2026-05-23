"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import type { FormAssertion } from "@/components/tool-call-assertion-form";
import type { Scorer, ToolCallAssertion } from "@/lib/eval-input-schema";
import type { EvalRunSummary } from "@/lib/evals";

import { updateAgentEvalsAction } from "@/actions/update-agent-evals";
import { AgentEvalPicker } from "@/components/agent-eval-picker";
import {
  formAssertionSchema,
  toFormAssertion,
  toServerAssertion,
  validateAssertionForm,
} from "@/components/tool-call-assertion-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { SCORER_OPTIONS, STRING_SCORERS } from "@/lib/eval-input-schema";

const formSchema = z.object({
  evals: z.array(
    z
      .object({
        assertion: formAssertionSchema,
        expected: z.string().trim().min(1).max(10_000).optional(),
        id: z.string().optional(),
        input: z.string().trim().min(1).max(10_000),
        name: z.string().trim().min(1).max(200),
        scorer: z.enum(SCORER_OPTIONS),
        trials: z.number().int().min(1).max(10),
      })
      .superRefine((value, ctx) => {
        if (STRING_SCORERS.includes(value.scorer) && !value.expected) {
          ctx.addIssue({
            code: "custom",
            message: "Expected output is required for this scorer.",
            path: ["expected"],
          });
        }

        if (value.scorer === "tool-call") {
          for (const message of validateAssertionForm(value.assertion)) {
            ctx.addIssue({ code: "custom", message, path: ["assertion"] });
          }
        }
      }),
  ),
});

interface InitialEval {
  assertion?: ToolCallAssertion;
  expected?: string;
  id: string;
  input: string;
  name: string;
  scorer: Scorer;
  trials: number;
}

interface Props {
  agentId: string;
  evalRuns: EvalRunSummary[];
  initialEvals: InitialEval[];
  subAgents: { alias: string }[];
}

export const AgentEvalsForm = ({ agentId, evalRuns, initialEvals, subAgents }: Props) => {
  const { execute, isPending, result } = useAction(updateAgentEvalsAction, {
    onSuccess: () => {
      toast.success("saved");
    },
  });

  const form = useForm({
    defaultValues: {
      evals: initialEvals.map(
        (
          e,
        ): {
          assertion: FormAssertion;
          expected?: string;
          id?: string;
          input: string;
          name: string;
          scorer: Scorer;
          trials: number;
        } => {
          return {
            assertion: toFormAssertion(e.assertion),
            expected: e.expected,
            id: e.id,
            input: e.input,
            name: e.name,
            scorer: e.scorer,
            trials: e.trials,
          };
        },
      ),
    },
    onSubmit: ({ value }) => {
      execute({
        agentId,
        evals: value.evals.map((e) => {
          return {
            assertion: e.scorer === "tool-call" ? toServerAssertion(e.assertion) : undefined,
            expected: e.expected?.trim() ? e.expected.trim() : undefined,
            id: e.id,
            input: e.input.trim(),
            name: e.name.trim(),
            scorer: e.scorer,
            trials: e.trials,
          };
        }),
      });
    },
    validators: {
      onSubmit: formSchema,
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field mode="array" name="evals">
        {(field) => {
          return (
            <Field>
              <FieldLabel>evals</FieldLabel>
              <FieldDescription>
                test cases for your agent. each eval sends a fixed input and checks the response.
              </FieldDescription>
              <AgentEvalPicker
                agentId={agentId}
                initialRuns={evalRuns}
                isEdit
                onChange={(next) => {
                  field.handleChange(next);
                }}
                subAgents={subAgents}
                value={field.state.value}
              />
            </Field>
          );
        }}
      </form.Field>

      {result.serverError ? <p className="text-destructive text-sm">{result.serverError}</p> : null}

      <div className="flex justify-end">
        <Button disabled={isPending} type="submit">
          {isPending ? "saving..." : "save"}
        </Button>
      </div>
    </form>
  );
};
