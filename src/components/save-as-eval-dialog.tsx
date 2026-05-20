"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { addAgentEvalAction } from "@/actions/add-agent-eval";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SCORER_OPTIONS, STRING_SCORERS } from "@/lib/eval-input-schema";

const isScorer = (value: string): value is Scorer => {
  return (SCORER_OPTIONS as readonly string[]).includes(value);
};

const formSchema = z
  .object({
    expected: z.string().trim().max(10_000),
    input: z.string().trim().min(1).max(10_000),
    name: z.string().trim().min(1).max(200),
    scorer: z.enum(SCORER_OPTIONS),
  })
  .superRefine((value, ctx) => {
    if (STRING_SCORERS.includes(value.scorer) && !value.expected) {
      ctx.addIssue({
        code: "custom",
        message: "Expected output is required for this scorer.",
        path: ["expected"],
      });
    }
  });

interface FormProps {
  agentId: string;
  defaultExpected: string;
  defaultInput: string;
  onSaved: () => void;
}

const SaveAsEvalForm = ({ agentId, defaultExpected, defaultInput, onSaved }: FormProps) => {
  const { execute, isPending, result } = useAction(addAgentEvalAction, {
    onSuccess: () => {
      toast.success("eval saved");
      onSaved();
    },
  });

  const form = useForm({
    defaultValues: {
      expected: defaultExpected,
      input: defaultInput,
      name: "",
      scorer: "contains" as Scorer,
    },
    onSubmit: ({ value }) => {
      execute({
        agentId,
        entry: {
          expected: value.expected.trim() || undefined,
          input: value.input.trim(),
          name: value.name.trim(),
          scorer: value.scorer,
        },
      });
    },
    validators: {
      onSubmit: formSchema,
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <ScrollArea className="max-h-[60vh]">
        <FieldGroup className="pr-3">
          <form.Field name="name">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor={field.name}>name</FieldLabel>
                  <Input
                    aria-invalid={isInvalid || undefined}
                    id={field.name}
                    maxLength={200}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    placeholder="greets the user"
                    value={field.state.value}
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="input">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor={field.name}>input</FieldLabel>
                  <FieldDescription>the user message sent to the agent.</FieldDescription>
                  <Textarea
                    aria-invalid={isInvalid || undefined}
                    className="resize-none font-mono text-xs"
                    id={field.name}
                    maxLength={10_000}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    rows={4}
                    value={field.state.value}
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          </form.Field>

          <form.Subscribe selector={(state) => state.values.scorer}>
            {(scorer) => {
              if (scorer === "llm-judge") return null;

              return (
                <form.Field name="expected">
                  {(field) => {
                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>expected</FieldLabel>
                        <FieldDescription>
                          what the response should contain or match.
                        </FieldDescription>
                        <Textarea
                          aria-invalid={isInvalid || undefined}
                          className="resize-none font-mono text-xs"
                          id={field.name}
                          maxLength={10_000}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            field.handleChange(event.target.value);
                          }}
                          rows={4}
                          value={field.state.value}
                        />
                        {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                      </Field>
                    );
                  }}
                </form.Field>
              );
            }}
          </form.Subscribe>

          <form.Field name="scorer">
            {(field) => {
              return (
                <Field>
                  <FieldLabel htmlFor={field.name}>scorer</FieldLabel>
                  <Select
                    onValueChange={(value) => {
                      if (isScorer(value)) field.handleChange(value);
                    }}
                    value={field.state.value}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCORER_OPTIONS.map((option) => {
                        return (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </Field>
              );
            }}
          </form.Field>

          {result.serverError ? (
            <p className="text-destructive text-sm">{result.serverError}</p>
          ) : null}
        </FieldGroup>
      </ScrollArea>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            cancel
          </Button>
        </DialogClose>
        <Button disabled={isPending} type="submit">
          {isPending ? "saving..." : "save"}
        </Button>
      </DialogFooter>
    </form>
  );
};

interface Props {
  agentId: string;
  defaultExpected: string;
  defaultInput: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const SaveAsEvalDialog = ({
  agentId,
  defaultExpected,
  defaultInput,
  onOpenChange,
  open,
}: Props) => {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>save as eval</DialogTitle>
          <DialogDescription>
            turn this turn into a test case that runs against the agent.
          </DialogDescription>
        </DialogHeader>
        <SaveAsEvalForm
          agentId={agentId}
          defaultExpected={defaultExpected}
          defaultInput={defaultInput}
          onSaved={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
