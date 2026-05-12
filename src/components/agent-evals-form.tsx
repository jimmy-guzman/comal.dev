"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { updateAgentEvalsAction } from "@/actions/update-agent-evals";
import { AgentEvalPicker } from "@/components/agent-eval-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { SCORER_OPTIONS } from "@/lib/eval-input-schema";

const formSchema = z.object({
  evals: z.array(
    z.object({
      expected: z.string().trim().min(1).max(10_000),
      id: z.string().optional(),
      input: z.string().trim().min(1).max(10_000),
      name: z.string().trim().min(1).max(200),
      scorer: z.enum(SCORER_OPTIONS),
    }),
  ),
});

interface EvalRun {
  evalId: string;
  lastRunAt: Date | null;
  lastRunOutput: null | string;
  lastRunScore: null | number;
}

interface InitialEval {
  expected: string;
  id: string;
  input: string;
  name: string;
  scorer: Scorer;
}

interface Props {
  agentId: string;
  evalRuns: EvalRun[];
  initialEvals: InitialEval[];
}

export const AgentEvalsForm = ({ agentId, evalRuns, initialEvals }: Props) => {
  const { execute, isPending, result } = useAction(updateAgentEvalsAction, {
    onSuccess: () => {
      toast.success("saved");
    },
  });

  const form = useForm({
    defaultValues: {
      evals: initialEvals.map(
        (e): { expected: string; id?: string; input: string; name: string; scorer: Scorer } => {
          return { expected: e.expected, id: e.id, input: e.input, name: e.name, scorer: e.scorer };
        },
      ),
    },
    onSubmit: ({ value }) => {
      execute({
        agentId,
        evals: value.evals.map((e) => {
          return {
            expected: e.expected.trim(),
            id: e.id,
            input: e.input.trim(),
            name: e.name.trim(),
            scorer: e.scorer,
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
                initialRuns={evalRuns}
                isEdit
                onChange={(next) => {
                  field.handleChange(next);
                }}
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
