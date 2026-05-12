"use client";

import { useForm } from "@tanstack/react-form";
import { compact, flatMap } from "es-toolkit";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { OwnedAgent } from "@/components/agent-subagent-picker";

import { updateAgentSubagentsAction } from "@/actions/update-agent-subagents";
import { AgentSubagentPicker } from "@/components/agent-subagent-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

const formSchema = z.object({
  subAgents: z.array(
    z.object({
      alias: z
        .string()
        .trim()
        .min(1)
        .max(32)
        .regex(/^[\w-]+$/, "alias may only contain letters, numbers, hyphens, and underscores."),
      childAgentId: z.string().min(1),
      descriptionOverride: z.string().trim().max(1024),
    }),
  ),
});

const isRecord = (v: unknown): v is Record<string, unknown> => {
  return typeof v === "object" && v !== null && !Array.isArray(v);
};

const isStringArray = (v: unknown): v is string[] => {
  return Array.isArray(v) && v.every((i) => typeof i === "string");
};

const extractSubAgentErrors = (validationErrors: unknown): { message: string }[] => {
  if (!isRecord(validationErrors)) return [];

  const { subAgents } = validationErrors;

  if (!isRecord(subAgents)) return [];

  const messages = flatMap(Object.values(subAgents), (v) => {
    if (isStringArray(v)) return v;

    if (isRecord(v)) {
      const { childAgentId } = v;

      return isRecord(childAgentId) && isStringArray(childAgentId._errors)
        ? childAgentId._errors
        : [];
    }

    return [];
  });

  return compact(messages).map((message) => ({ message }));
};

interface SubAgentEntry {
  alias: string;
  childAgentId: string;
  descriptionOverride: string;
}

interface Props {
  agentId: string;
  initialSubAgents: { alias: string; childAgentId: string; descriptionOverride: null | string }[];
  ownedAgents: OwnedAgent[];
}

export const AgentSubagentsForm = ({ agentId, initialSubAgents, ownedAgents }: Props) => {
  const [subAgentErrors, setSubAgentErrors] = useState<{ message: string }[]>([]);

  const { execute, isPending, result } = useAction(updateAgentSubagentsAction, {
    onError: ({ error }) => {
      setSubAgentErrors(extractSubAgentErrors(error.validationErrors));
    },
    onSuccess: () => {
      setSubAgentErrors([]);
      toast.success("saved");
    },
  });

  const form = useForm({
    defaultValues: {
      subAgents: initialSubAgents.map((s): SubAgentEntry => {
        return {
          alias: s.alias,
          childAgentId: s.childAgentId,
          descriptionOverride: s.descriptionOverride ?? "",
        };
      }),
    },
    onSubmit: ({ value }) => {
      execute({
        agentId,
        subAgents: value.subAgents.map((s) => {
          return {
            alias: s.alias.trim(),
            childAgentId: s.childAgentId,
            descriptionOverride: s.descriptionOverride.trim() || undefined,
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
      <form.Field mode="array" name="subAgents">
        {(field) => {
          return (
            <Field
              data-invalid={
                subAgentErrors.length > 0 || field.state.meta.errors.length > 0 || undefined
              }
            >
              <FieldLabel>sub-agents</FieldLabel>
              <FieldDescription>
                other agents this agent can delegate tasks to as tools.
              </FieldDescription>
              <AgentSubagentPicker
                currentAgentId={agentId}
                onChange={(next) => {
                  setSubAgentErrors([]);
                  field.handleChange(next);
                }}
                ownedAgents={ownedAgents}
                value={field.state.value}
              />
              <FieldError errors={[...subAgentErrors, ...field.state.meta.errors]} />
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
