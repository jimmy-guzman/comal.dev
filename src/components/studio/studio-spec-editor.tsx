"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updateWorkspaceSpecAction } from "@/app/actions/update-workspace-spec";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type StudioSpecEditorProps = {
  workspaceId: string;
  initialContent: string;
  initialRevisionNumber: number;
  canEdit: boolean;
};

export function StudioSpecEditor({
  workspaceId,
  initialContent,
  initialRevisionNumber,
  canEdit,
}: StudioSpecEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [revisionNumber, setRevisionNumber] = useState(initialRevisionNumber);
  const lastSyncedServerRevision = useRef(initialRevisionNumber);

  useEffect(() => {
    if (initialRevisionNumber <= lastSyncedServerRevision.current) {
      return;
    }
    lastSyncedServerRevision.current = initialRevisionNumber;
    setContent(initialContent);
    setRevisionNumber(initialRevisionNumber);
  }, [initialContent, initialRevisionNumber]);

  const isDirty = content !== initialContent;

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
      <div className="text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          Revision {revisionNumber}
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
