import { z } from "zod";

import type { ToolCallAssertion } from "@/lib/eval-input-schema";

import { toolCallAssertionSchema } from "@/lib/eval-input-schema";

export const formAssertionSchema = z.object({
  mustCall: z.array(z.string()),
  mustCallWithArgsJson: z.string(),
  mustNotCall: z.array(z.string()),
});

export type FormAssertion = z.infer<typeof formAssertionSchema>;

export const emptyFormAssertion = (): FormAssertion => {
  return { mustCall: [], mustCallWithArgsJson: "", mustNotCall: [] };
};

export const toFormAssertion = (assertion: ToolCallAssertion | undefined): FormAssertion => {
  const mustCallWithArgs = assertion?.mustCallWithArgs ?? [];

  return {
    mustCall: assertion?.mustCall ?? [],
    mustCallWithArgsJson:
      mustCallWithArgs.length > 0 ? JSON.stringify(mustCallWithArgs, null, 2) : "",
    mustNotCall: assertion?.mustNotCall ?? [],
  };
};

export const toServerAssertion = (form: FormAssertion): ToolCallAssertion => {
  const trimmed = form.mustCallWithArgsJson.trim();
  const mustCallWithArgs: unknown = trimmed ? JSON.parse(trimmed) : [];

  return toolCallAssertionSchema.parse({
    ...(form.mustCall.length > 0 ? { mustCall: form.mustCall } : {}),
    ...(Array.isArray(mustCallWithArgs) && mustCallWithArgs.length > 0 ? { mustCallWithArgs } : {}),
    ...(form.mustNotCall.length > 0 ? { mustNotCall: form.mustNotCall } : {}),
  });
};

export const validateAssertionForm = (form: FormAssertion): string[] => {
  try {
    toServerAssertion(form);

    return [];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues.map((issue) => issue.message);
    }

    return ["Tool args must be a valid JSON array."];
  }
};
