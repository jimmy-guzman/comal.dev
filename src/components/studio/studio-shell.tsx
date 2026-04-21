"use client";

import type { UIMessage } from "ai";
import { ArrowLeftRightIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { StudioChat } from "@/components/studio/studio-chat";
import {
  StudioPlaygroundPlaceholder,
  StudioSpecPlaceholder,
} from "@/components/studio/studio-placeholder-panes";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignStudioPane,
  DEFAULT_STUDIO_PANES,
  type StudioPaneId,
  STUDIO_PANE_IDS,
  STUDIO_PANE_LABEL,
  swapStudioPanes,
  type StudioPanePair,
} from "@/lib/studio-pane-ids";

type StudioShellProps = {
  workspaceId: string;
  initialMessages?: UIMessage[];
};

function StudioPaneBody({
  id,
  workspaceId,
  initialMessages,
}: {
  id: StudioPaneId;
  workspaceId: string;
  initialMessages: UIMessage[];
}) {
  switch (id) {
    case "chat": {
      return <StudioChat initialMessages={initialMessages} workspaceId={workspaceId} />;
    }
    case "playground": {
      return <StudioPlaygroundPlaceholder />;
    }
    case "spec": {
      return <StudioSpecPlaceholder />;
    }
  }
}

export function StudioShell({ workspaceId, initialMessages = [] }: StudioShellProps) {
  const [panes, setPanes] = useState<StudioPanePair>(DEFAULT_STUDIO_PANES);

  const setLeft = useCallback((pane: StudioPaneId) => {
    setPanes((current) => assignStudioPane("left", pane, current));
  }, []);

  const setRight = useCallback((pane: StudioPaneId) => {
    setPanes((current) => assignStudioPane("right", pane, current));
  }, []);

  const swap = useCallback(() => {
    setPanes((current) => swapStudioPanes(current));
  }, []);

  return (
    <div className="bg-border flex min-h-0 flex-1 flex-row gap-px">
      <section
        aria-label={`Left column: ${STUDIO_PANE_LABEL[panes.left]}`}
        className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <header className="border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="text-foreground text-sm font-medium">{STUDIO_PANE_LABEL[panes.left]}</h2>
          <Select onValueChange={(value) => setLeft(value as StudioPaneId)} value={panes.left}>
            <SelectTrigger className="max-w-44" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STUDIO_PANE_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {STUDIO_PANE_LABEL[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
          <StudioPaneBody
            id={panes.left}
            initialMessages={initialMessages}
            workspaceId={workspaceId}
          />
        </div>
      </section>

      <div className="bg-border border-border flex w-11 shrink-0 flex-col items-center justify-center border-x px-0.5">
        <Button
          aria-label="Swap left and right panes"
          className="size-8 shrink-0 rounded-none"
          onClick={swap}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowLeftRightIcon className="size-4" />
        </Button>
      </div>

      <section
        aria-label={`Right column: ${STUDIO_PANE_LABEL[panes.right]}`}
        className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <header className="border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="text-foreground text-sm font-medium">{STUDIO_PANE_LABEL[panes.right]}</h2>
          <Select onValueChange={(value) => setRight(value as StudioPaneId)} value={panes.right}>
            <SelectTrigger className="max-w-44" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STUDIO_PANE_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {STUDIO_PANE_LABEL[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
          <StudioPaneBody
            id={panes.right}
            initialMessages={initialMessages}
            workspaceId={workspaceId}
          />
        </div>
      </section>
    </div>
  );
}
