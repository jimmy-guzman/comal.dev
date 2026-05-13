"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import { updateAgentBasicsAction } from "@/actions/update-agent-basics";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
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
import { getModelCostLabel, MODEL_GROUPS, MODEL_IDS } from "@/config/models";

const formSchema = z.object({
  defaultModelId: z.enum(MODEL_IDS),
  description: z.string().trim().max(500),
  name: z.string().trim().min(1).max(100),
});

interface Props {
  agentId: string;
  initialDefaultModelId: string;
  initialDescription: null | string;
  initialName: string;
}

export const AgentBasicsForm = ({
  agentId,
  initialDefaultModelId,
  initialDescription,
  initialName,
}: Props) => {
  const { execute, isPending, result } = useAction(updateAgentBasicsAction, {
    onSuccess: () => {
      toast.success("saved");
    },
  });

  const form = useForm({
    defaultValues: {
      defaultModelId: initialDefaultModelId as (typeof MODEL_IDS)[number],
      description: initialDescription ?? "",
      name: initialName,
    },
    onSubmit: ({ value }) => {
      execute({
        agentId,
        defaultModelId: value.defaultModelId,
        description: value.description.trim() || undefined,
        name: value.name.trim(),
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
      <form.Field name="name">
        {(field) => {
          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

          return (
            <Field data-invalid={isInvalid || undefined}>
              <FieldLabel htmlFor={field.name}>name</FieldLabel>
              <Input
                aria-invalid={isInvalid || undefined}
                id={field.name}
                maxLength={100}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder="my agent"
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
              <FieldLabel htmlFor={field.name}>description</FieldLabel>
              <FieldDescription>a short summary shown in the agent list.</FieldDescription>
              <Textarea
                aria-invalid={isInvalid || undefined}
                className="resize-none"
                id={field.name}
                maxLength={500}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder="what this agent does..."
                rows={3}
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
              <FieldLabel htmlFor={field.name}>default model</FieldLabel>
              <FieldDescription>
                the model used when starting a new conversation with this agent.
              </FieldDescription>
              <Select
                onValueChange={(value) => {
                  field.handleChange(value as (typeof MODEL_IDS)[number]);
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
                              <span className="flex w-full items-center justify-between gap-2">
                                <span>{model.name}</span>
                                <span className="text-muted-foreground text-xs tracking-tight">
                                  {getModelCostLabel(model.id)}
                                </span>
                              </span>
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

      {result.serverError ? <p className="text-destructive text-sm">{result.serverError}</p> : null}

      <div className="flex justify-end">
        <Button disabled={isPending} type="submit">
          {isPending ? "saving..." : "save"}
        </Button>
      </div>
    </form>
  );
};
