"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { ApiKeyConnectionStatus } from "@/lib/credentials/service";

import { clearCredentialAction } from "@/actions/clear-credential";
import { setCredentialAction } from "@/actions/set-credential";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatRelative } from "@/lib/format-relative";

const formSchema = z.object({
  apiKey: z.string().trim().min(1).max(500),
});

interface ApiKeyConnectionRowProps {
  note?: string;
  status: ApiKeyConnectionStatus;
}

export const ApiKeyConnectionRow = ({ note, status }: ApiKeyConnectionRowProps) => {
  const { docsUrl } = status;
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  const setAction = useAction(setCredentialAction);
  const clearAction = useAction(clearCredentialAction);

  const form = useForm({
    defaultValues: { apiKey: "" },
    onSubmit: async ({ formApi, value }) => {
      const outcome = await setAction.executeAsync({
        apiKey: value.apiKey.trim(),
        providerId: status.providerId,
      });

      if (outcome.data) {
        toast.success(`${status.displayName} key saved`);
        formApi.reset();
        setIsEditing(false);
        router.refresh();
      }
    },
    validators: { onSubmit: formSchema },
  });

  const onClear = async () => {
    const outcome = await clearAction.executeAsync({ providerId: status.providerId });

    if (outcome.data) {
      toast.success(`${status.displayName} key cleared`);
      form.reset();
      setIsEditing(false);
      router.refresh();
    }
  };

  const statusLabel =
    status.source === "user" && status.connectedAt
      ? `using your key, set ${formatRelative(status.connectedAt)}`
      : status.source === "env"
        ? "using platform key"
        : "not configured";

  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium">{status.displayName.toLowerCase()}</h3>
            <Badge variant={status.source === "user" ? "default" : "secondary"}>
              {statusLabel}
            </Badge>
          </div>
          {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
          {docsUrl ? (
            <a
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
              href={docsUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              get a key
            </a>
          ) : null}
        </div>

        <div className="flex gap-2">
          {status.source === "user" ? (
            <Button
              disabled={clearAction.isPending}
              onClick={() => {
                void onClear();
              }}
              size="sm"
              variant="ghost"
            >
              {clearAction.isPending ? "clearing..." : "clear"}
            </Button>
          ) : null}
          {isEditing ? null : (
            <Button
              onClick={() => {
                setIsEditing(true);
              }}
              size="sm"
              variant="outline"
            >
              {status.source === "user" ? "replace" : "set key"}
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="apiKey">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid || undefined}>
                  <FieldLabel htmlFor={field.name}>api key</FieldLabel>
                  <Input
                    aria-invalid={isInvalid || undefined}
                    autoComplete="off"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    placeholder="paste your key"
                    type="password"
                    value={field.state.value}
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          </form.Field>

          {setAction.result.serverError ? (
            <p className="text-destructive text-sm">{setAction.result.serverError}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setIsEditing(false);
                form.reset();
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              cancel
            </Button>
            <Button disabled={setAction.isPending} size="sm" type="submit">
              {setAction.isPending ? "saving..." : "save"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
};
