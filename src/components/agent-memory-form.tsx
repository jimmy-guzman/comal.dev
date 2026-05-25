"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import { updateAgentMemoryAction } from "@/actions/update-agent-memory";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  enableMemory: z.boolean(),
});

interface Props {
  agentId: string;
  initialEnableMemory: boolean;
  readOnly?: boolean;
}

export const AgentMemoryForm = ({ agentId, initialEnableMemory, readOnly = false }: Props) => {
  const { execute, isPending, result } = useAction(updateAgentMemoryAction, {
    onSuccess: () => {
      toast.success("saved");
    },
  });

  const form = useForm({
    defaultValues: {
      enableMemory: initialEnableMemory,
    },
    onSubmit: ({ value }) => {
      execute({ agentId, enableMemory: value.enableMemory });
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
      <form.Field name="enableMemory">
        {(field) => {
          return (
            <Field>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor={field.name}>enable memory</FieldLabel>
                  <FieldDescription>
                    let this agent save and recall facts about you across conversations. matching
                    memories are auto-injected into the system prompt.
                  </FieldDescription>
                </div>
                <Switch
                  checked={field.state.value}
                  disabled={readOnly}
                  id={field.name}
                  onCheckedChange={(checked) => {
                    field.handleChange(checked);
                  }}
                />
              </div>
            </Field>
          );
        }}
      </form.Field>

      {result.serverError ? <p className="text-destructive text-sm">{result.serverError}</p> : null}

      {readOnly ? null : (
        <div className="flex justify-end">
          <Button disabled={isPending} type="submit">
            {isPending ? "saving..." : "save"}
          </Button>
        </div>
      )}
    </form>
  );
};
