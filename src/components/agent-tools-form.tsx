"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import type { ToolSelection } from "@/lib/agent-tool-selection";

import { updateAgentToolsAction } from "@/actions/update-agent-tools";
import { AgentToolPicker } from "@/components/agent-tool-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { initialToolSelections } from "@/lib/agent-tool-selection";

const formSchema = z.object({
  tools: z.array(
    z.object({
      config: z.record(z.string(), z.unknown()),
      enabled: z.boolean(),
      toolId: z.string(),
    }),
  ),
});

interface Props {
  agentId: string;
  initialTools: { config: unknown; toolId: string }[];
  readOnly?: boolean;
}

export const AgentToolsForm = ({ agentId, initialTools, readOnly = false }: Props) => {
  const { execute, isPending, result } = useAction(updateAgentToolsAction, {
    onSuccess: () => {
      toast.success("saved");
    },
  });

  const form = useForm({
    defaultValues: {
      tools: initialToolSelections(initialTools),
    },
    onSubmit: ({ value }) => {
      const tools = value.tools
        .filter((entry) => entry.enabled)
        .map((entry) => ({ config: entry.config, toolId: entry.toolId }));

      execute({ agentId, tools });
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
      <form.Field mode="array" name="tools">
        {(field) => {
          return (
            <Field>
              <FieldLabel>tools</FieldLabel>
              <FieldDescription>
                pick from the library and configure each tool's behavior.
              </FieldDescription>
              <AgentToolPicker
                onChange={(next: ToolSelection[]) => {
                  field.handleChange(next);
                }}
                readOnly={readOnly}
                value={field.state.value}
              />
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
