"use client";

import { useForm } from "@tanstack/react-form";
import { PlusIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import { updateAgentSuggestionsAction } from "@/actions/update-agent-suggestions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const MAX_SUGGESTIONS = 8;
const MAX_LENGTH = 100;

const formSchema = z.object({
  suggestions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().trim().max(MAX_LENGTH),
      }),
    )
    .max(MAX_SUGGESTIONS),
});

interface Props {
  agentId: string;
  initialSuggestions: string[];
}

export const AgentSuggestionsForm = ({ agentId, initialSuggestions }: Props) => {
  const { execute, isPending, result } = useAction(updateAgentSuggestionsAction, {
    onSuccess: () => {
      toast.success("saved");
    },
  });

  const form = useForm({
    defaultValues: {
      suggestions: initialSuggestions.map((text) => ({ id: nanoid(), text })),
    },
    onSubmit: ({ value }) => {
      const cleaned = value.suggestions
        .map((row) => row.text.trim())
        .filter((text) => text.length > 0);

      execute({ agentId, suggestions: cleaned });
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
      <form.Field mode="array" name="suggestions">
        {(field) => {
          const items = field.state.value;
          const canAdd = items.length < MAX_SUGGESTIONS;

          return (
            <Field>
              <FieldLabel>starter suggestions</FieldLabel>
              <FieldDescription>
                shown as quick-tap buttons when a new chat with this agent is empty. up to{" "}
                {MAX_SUGGESTIONS}.
              </FieldDescription>

              <div className="flex flex-col gap-2">
                {items.map((row, index) => {
                  return (
                    <form.Field key={row.id} name={`suggestions[${index}].text`}>
                      {(itemField) => {
                        return (
                          <div className="flex gap-2">
                            <Input
                              maxLength={MAX_LENGTH}
                              onBlur={itemField.handleBlur}
                              onChange={(event) => {
                                itemField.handleChange(event.target.value);
                              }}
                              placeholder="what can you do?"
                              value={itemField.state.value}
                            />
                            <Button
                              aria-label="remove suggestion"
                              onClick={() => {
                                field.removeValue(index);
                              }}
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <XIcon className="size-4" />
                            </Button>
                          </div>
                        );
                      }}
                    </form.Field>
                  );
                })}

                <Button
                  className="self-start"
                  disabled={!canAdd}
                  onClick={() => {
                    field.pushValue({ id: nanoid(), text: "" });
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <PlusIcon className="size-4" />
                  add suggestion
                </Button>
              </div>

              {field.state.meta.errors.length > 0 ? (
                <FieldError errors={field.state.meta.errors} />
              ) : null}
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
