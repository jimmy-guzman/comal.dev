"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import { addMemoryAction } from "@/actions/add-memory";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const MemoryAddForm = () => {
  const { execute, isPending, result } = useAction(addMemoryAction, {
    onSuccess: () => {
      toast.success("memory saved");
    },
  });

  const form = useForm({
    defaultValues: {
      content: "",
    },
    onSubmit: ({ formApi, value }) => {
      execute({ content: value.content.trim() });
      formApi.reset();
    },
    validators: {
      onSubmit: formSchema,
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="content">
        {(field) => {
          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

          return (
            <Field data-invalid={isInvalid || undefined}>
              <FieldLabel htmlFor={field.name}>add a memory</FieldLabel>
              <Textarea
                aria-invalid={isInvalid || undefined}
                className="resize-none"
                id={field.name}
                maxLength={2000}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder="e.g. user lives in austin, prefers dark mode, etc."
                rows={3}
                value={field.state.value}
              />
              {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
            </Field>
          );
        }}
      </form.Field>

      {result.serverError ? <p className="text-destructive text-sm">{result.serverError}</p> : null}

      <div className="flex justify-end">
        <Button disabled={isPending} size="sm" type="submit">
          {isPending ? "saving..." : "save"}
        </Button>
      </div>
    </form>
  );
};
