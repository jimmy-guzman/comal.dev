"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import { updateAgentPromptAction } from "@/actions/update-agent-prompt";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  systemPrompt: z.string().trim().min(1).max(20_000),
});

interface Props {
  agentId: string;
  initialSystemPrompt: string;
}

export const AgentPromptForm = ({ agentId, initialSystemPrompt }: Props) => {
  const { execute, isPending, result } = useAction(updateAgentPromptAction, {
    onSuccess: () => {
      toast.success("saved");
    },
  });

  const form = useForm({
    defaultValues: {
      systemPrompt: initialSystemPrompt,
    },
    onSubmit: ({ value }) => {
      execute({ agentId, systemPrompt: value.systemPrompt.trim() });
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
      <form.Field name="systemPrompt">
        {(field) => {
          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

          return (
            <Field data-invalid={isInvalid || undefined}>
              <FieldLabel htmlFor={field.name}>system prompt</FieldLabel>
              <FieldDescription>
                instructions the model receives at the start of every conversation.
              </FieldDescription>
              <Textarea
                aria-invalid={isInvalid || undefined}
                className="field-sizing-content min-h-64 resize-none font-mono text-xs"
                id={field.name}
                maxLength={20_000}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder="you are a helpful assistant..."
                value={field.state.value}
              />
              {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
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
