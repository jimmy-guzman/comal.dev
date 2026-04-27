"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { z } from "zod";

import type { ModelId } from "@/config/models";

import { createAgentAction } from "@/actions/create-agent";
import { updateAgentAction } from "@/actions/update-agent";
import { AgentToolPicker } from "@/components/agent-tool-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MODEL_GROUPS, MODEL_IDS } from "@/config/models";
import { initialToolSelections } from "@/lib/agent-tool-selection";

const formSchema = z.object({
  defaultModelId: z.enum(MODEL_IDS),
  description: z.string().trim().max(500),
  name: z.string().trim().min(1).max(100),
  systemPrompt: z.string().trim().min(1).max(20_000),
  tools: z.array(
    z.object({
      config: z.record(z.string(), z.unknown()),
      enabled: z.boolean(),
      toolId: z.string(),
    }),
  ),
});

interface InitialAgent {
  defaultModelId: string;
  description: null | string;
  id: string;
  name: string;
  systemPrompt: string;
  tools: { config: unknown; toolId: string }[];
}

interface Props {
  initialAgent?: InitialAgent;
}

const DEFAULT_MODEL_ID: ModelId = "anthropic/claude-haiku-4.5";

const isModelId = (value: string): value is ModelId => {
  return (MODEL_IDS as readonly string[]).includes(value);
};

const resolveModelId = (incoming: string | undefined): ModelId => {
  return incoming && isModelId(incoming) ? incoming : DEFAULT_MODEL_ID;
};

export const AgentForm = ({ initialAgent }: Props) => {
  const router = useRouter();
  const isEdit = Boolean(initialAgent);

  const create = useAction(createAgentAction, {
    onSuccess: ({ data }) => {
      router.push(`/agents/${data.id}`);
    },
  });

  const update = useAction(updateAgentAction, {
    onSuccess: ({ data }) => {
      router.push(`/agents/${data.agentId}`);
    },
  });

  const isPending = create.isPending || update.isPending;
  const serverError = isEdit ? update.result.serverError : create.result.serverError;

  const form = useForm({
    defaultValues: {
      defaultModelId: resolveModelId(initialAgent?.defaultModelId),
      description: initialAgent?.description ?? "",
      name: initialAgent?.name ?? "",
      systemPrompt: initialAgent?.systemPrompt ?? "",
      tools: initialToolSelections(initialAgent?.tools),
    },
    onSubmit: ({ value }) => {
      const tools = value.tools
        .filter((entry) => entry.enabled)
        .map((entry) => ({ config: entry.config, toolId: entry.toolId }));

      const input = {
        defaultModelId: value.defaultModelId,
        description: value.description.trim() || undefined,
        name: value.name.trim(),
        systemPrompt: value.systemPrompt.trim(),
        tools,
      };

      if (initialAgent) {
        update.execute({ agentId: initialAgent.id, ...input });
      } else {
        create.execute(input);
      }
    },
    validators: {
      onSubmit: formSchema,
    },
  });

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="name">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  aria-invalid={isInvalid || undefined}
                  id={field.name}
                  maxLength={100}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="Research assistant"
                  value={field.state.value}
                />
                {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="description">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                <FieldDescription>Shown on the agent card. Optional.</FieldDescription>
                <Input
                  aria-invalid={isInvalid || undefined}
                  id={field.name}
                  maxLength={500}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="What this agent is good at"
                  value={field.state.value}
                />
                {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="defaultModelId">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor={field.name}>Default model</FieldLabel>
                <FieldDescription>
                  Used for the first turn of new conversations. Switchable per conversation later.
                </FieldDescription>
                <Select
                  name={field.name}
                  onValueChange={(value) => {
                    if (isModelId(value)) field.handleChange(value);
                  }}
                  value={field.state.value}
                >
                  <SelectTrigger aria-invalid={isInvalid || undefined} id={field.name}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_GROUPS.map((group) => {
                      return (
                        <SelectGroup key={group.label}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.models.map((model) => {
                            return (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name}
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
                {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="systemPrompt">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor={field.name}>System prompt</FieldLabel>
                <FieldDescription>
                  Instructions the model receives at the start of every conversation.
                </FieldDescription>
                <Textarea
                  aria-invalid={isInvalid || undefined}
                  className="min-h-48 font-mono text-xs"
                  id={field.name}
                  maxLength={20_000}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="You are a helpful assistant..."
                  value={field.state.value}
                />
                {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
              </Field>
            );
          }}
        </form.Field>

        <form.Field mode="array" name="tools">
          {(field) => {
            return (
              <Field>
                <FieldLabel>Tools</FieldLabel>
                <FieldDescription>Pick which tools this agent can call.</FieldDescription>
                <AgentToolPicker
                  onChange={(next) => {
                    field.handleChange(next);
                  }}
                  value={field.state.value}
                />
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

      {serverError ? <p className="text-destructive text-sm">{serverError}</p> : null}

      <div className="flex justify-end gap-2">
        <Button
          disabled={isPending}
          onClick={() => {
            router.back();
          }}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving..." : isEdit ? "Save changes" : "Create agent"}
        </Button>
      </div>
    </form>
  );
};
