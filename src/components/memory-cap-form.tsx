"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import { updateMemoryCapAction } from "@/actions/update-memory-cap";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  cap: z.number().int().min(1).max(10_000),
});

interface Props {
  initialCap: number;
}

export const MemoryCapForm = ({ initialCap }: Props) => {
  const { execute, isPending, result } = useAction(updateMemoryCapAction, {
    onSuccess: () => {
      toast.success("cap updated");
    },
  });

  const form = useForm({
    defaultValues: {
      cap: initialCap,
    },
    onSubmit: ({ value }) => {
      execute({ cap: value.cap });
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
      <form.Field name="cap">
        {(field) => {
          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

          return (
            <Field data-invalid={isInvalid || undefined}>
              <FieldLabel htmlFor={field.name}>cap</FieldLabel>
              <FieldDescription>
                maximum number of memories to keep. agents stop saving when the cap is hit.
              </FieldDescription>
              <Input
                aria-invalid={isInvalid || undefined}
                className="max-w-32"
                id={field.name}
                inputMode="numeric"
                max={10_000}
                min={1}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(Number(event.target.value));
                }}
                type="number"
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
