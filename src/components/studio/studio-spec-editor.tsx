"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updateWorkspaceSpecAction } from "@/app/actions/update-workspace-spec";
import { validateWorkspaceSpecAction } from "@/app/actions/validate-workspace-spec";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { StudioSpecChatContext } from "@/lib/studio-spec-chat-context";
import type { ValidateWorkspaceSpecYamlResult } from "@/lib/validate-workspace-spec";

type StudioSpecEditorProps = {
  workspaceId: string;
  initialContent: string;
  initialRevisionNumber: number;
  canEdit: boolean;
  onChatContextChange?: (context: StudioSpecChatContext | null) => void;
};

function formatJsonPath(path: (string | number)[]) {
  if (path.length === 0) {
    return "document";
  }
  return path.map(String).join(" › ");
}

export function StudioSpecEditor({
  workspaceId,
  initialContent,
  initialRevisionNumber,
  canEdit,
  onChatContextChange,
}: StudioSpecEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [revisionNumber, setRevisionNumber] = useState(initialRevisionNumber);
  const lastSyncedServerRevision = useRef(initialRevisionNumber);
  const [validation, setValidation] = useState<ValidateWorkspaceSpecYamlResult | null>(null);
  const [validating, setValidating] = useState(false);
  const validationGeneration = useRef(0);

  useEffect(() => {
    if (initialRevisionNumber <= lastSyncedServerRevision.current) {
      return;
    }
    lastSyncedServerRevision.current = initialRevisionNumber;
    setContent(initialContent);
    setRevisionNumber(initialRevisionNumber);
  }, [initialContent, initialRevisionNumber]);

  const isDirty = content !== initialContent;

  const { executeAsync: validateSpecAsync } = useAction(validateWorkspaceSpecAction);

  useEffect(() => {
    const gen = ++validationGeneration.current;
    const pendingTimer = window.setTimeout(() => {
      setValidating(true);
    }, 0);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await validateSpecAsync({ content });
          if (gen !== validationGeneration.current) {
            return;
          }
          if (result.data) {
            setValidation(result.data);
          } else if (result.serverError != null) {
            setValidation({
              ok: false,
              stage: "yaml",
              message:
                typeof result.serverError === "string"
                  ? result.serverError
                  : "Validation request failed.",
            });
          } else {
            setValidation({
              ok: false,
              stage: "yaml",
              message: "Could not validate the spec.",
            });
          }
        } catch {
          if (gen === validationGeneration.current) {
            setValidation({
              ok: false,
              stage: "yaml",
              message: "Could not validate the spec.",
            });
          }
        } finally {
          if (gen === validationGeneration.current) {
            setValidating(false);
          }
        }
      })();
    }, 320);
    return () => {
      window.clearTimeout(pendingTimer);
      window.clearTimeout(timer);
    };
  }, [content, validateSpecAsync]);

  useEffect(() => {
    onChatContextChange?.({ draftYaml: content, validating });
  }, [content, validating, onChatContextChange]);

  useEffect(() => {
    return () => {
      onChatContextChange?.(null);
    };
  }, [onChatContextChange]);

  const { execute, status } = useAction(updateWorkspaceSpecAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }
      if (data.ok) {
        lastSyncedServerRevision.current = data.revisionNumber;
        setRevisionNumber(data.revisionNumber);
        return;
      }
      if (data.kind === "conflict") {
        toast.error("Spec was updated elsewhere. Reloading the latest version.");
        router.refresh();
        return;
      }
      if (data.kind === "forbidden") {
        toast.error("You do not have permission to edit this spec.");
        return;
      }
      toast.error("Could not save the spec.");
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Could not save the spec.");
    },
  });

  const isSaving = status === "executing";

  const statusSummary = (() => {
    if (validating || validation === null) {
      return "Checking…";
    }
    if (!validation.ok) {
      if (validation.stage === "yaml") {
        return validation.line ? `YAML error (line ${validation.line})` : "YAML error";
      }
      if (validation.stage === "version") {
        return "Unsupported OpenAPI version";
      }
      if (validation.stage === "openapi-ajv") {
        return `Schema: ${validation.errors.length} issue${validation.errors.length === 1 ? "" : "s"}`;
      }
      return `Lint: ${validation.issues.length} issue${validation.issues.length === 1 ? "" : "s"}`;
    }
    const n = validation.spectralIssues.length;
    if (n === 0) {
      return "Valid";
    }
    return `Valid · ${n} lint note${n === 1 ? "" : "s"}`;
  })();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      <Textarea
        className="min-h-0 flex-1 resize-none overflow-x-hidden overflow-y-auto rounded-none font-mono text-xs leading-relaxed"
        disabled={!canEdit || isSaving}
        onChange={(event) => setContent(event.target.value)}
        readOnly={!canEdit}
        spellCheck={false}
        value={content}
      />
      <ValidationPanel validation={validation} validating={validating} />
      <div className="text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          Revision {revisionNumber}
          {" · "}
          {statusSummary}
          {!canEdit ? " · View only" : null}
        </span>
        {canEdit ? (
          <Button
            disabled={!isDirty || isSaving}
            onClick={() => {
              void execute({
                workspaceId,
                content,
                expectedRevisionNumber: revisionNumber,
              });
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ValidationPanel({
  validation,
  validating,
}: {
  validation: ValidateWorkspaceSpecYamlResult | null;
  validating: boolean;
}) {
  if (validating || validation === null) {
    return null;
  }

  if (!validation.ok) {
    if (validation.stage === "yaml") {
      return (
        <Alert className="shrink-0 py-2" variant="destructive">
          <AlertTitle>YAML</AlertTitle>
          <AlertDescription>
            {validation.message}
            {validation.line != null ? ` (line ${validation.line})` : ""}
          </AlertDescription>
        </Alert>
      );
    }
    if (validation.stage === "version") {
      return (
        <Alert className="shrink-0 py-2" variant="destructive">
          <AlertTitle>Version</AlertTitle>
          <AlertDescription>{validation.message}</AlertDescription>
        </Alert>
      );
    }
    if (validation.stage === "openapi-ajv") {
      return (
        <ScrollArea className="border-border max-h-32 shrink-0 border">
          <ul className="space-y-1 p-2">
            {validation.errors.map((err, i) => (
              <li className="text-destructive text-xs" key={`${err.path}-${i}`}>
                <span className="text-muted-foreground font-mono text-[0.65rem]">{err.path}</span>
                {err.keyword ? (
                  <span className="text-muted-foreground"> [{err.keyword}]</span>
                ) : null}{" "}
                {err.message}
              </li>
            ))}
          </ul>
        </ScrollArea>
      );
    }
    return (
      <ScrollArea className="border-border max-h-32 shrink-0 border">
        <ul className="space-y-1 p-2">
          {validation.issues.map((issue, i) => (
            <li className="text-destructive text-xs" key={`${String(issue.code)}-${i}`}>
              <span className="text-muted-foreground font-mono text-[0.65rem]">
                {formatJsonPath(issue.path)}
              </span>{" "}
              <span className="text-muted-foreground">[{issue.code}]</span> {issue.message}
            </li>
          ))}
        </ul>
      </ScrollArea>
    );
  }

  if (validation.spectralIssues.length === 0) {
    return null;
  }

  return (
    <ScrollArea className="border-border max-h-32 shrink-0 border">
      <ul className="space-y-1 p-2">
        {validation.spectralIssues.map((issue, i) => (
          <li className="text-muted-foreground text-xs" key={`${String(issue.code)}-${i}`}>
            <span className="font-mono text-[0.65rem]">{formatJsonPath(issue.path)}</span>{" "}
            <span className="opacity-80">[{issue.code}]</span> {issue.message}
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
