"use client";

import type { UIMessage } from "ai";
import { useCallback, useState } from "react";

import { StudioChat } from "@/components/studio/studio-chat";
import { StudioPlaygroundPlaceholder } from "@/components/studio/studio-placeholder-panes";
import { StudioSpecEditor } from "@/components/studio/studio-spec-editor";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
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
  type StudioPanePair,
} from "@/lib/studio-pane-ids";

type StudioShellInitialSpec = {
  content: string;
  revisionNumber: number;
  canEdit: boolean;
};

type StudioShellProps = {
  workspaceId: string;
  initialMessages?: UIMessage[];
  initialSpec: StudioShellInitialSpec;
};

function StudioPaneBody({
  id,
  workspaceId,
  initialMessages,
  initialSpec,
}: {
  id: StudioPaneId;
  workspaceId: string;
  initialMessages: UIMessage[];
  initialSpec: StudioShellInitialSpec;
}) {
  switch (id) {
    case "chat": {
      return <StudioChat initialMessages={initialMessages} workspaceId={workspaceId} />;
    }
    case "playground": {
      return <StudioPlaygroundPlaceholder />;
    }
    case "spec": {
      return (
        <StudioSpecEditor
          key={workspaceId}
          canEdit={initialSpec.canEdit}
          initialContent={initialSpec.content}
          initialRevisionNumber={initialSpec.revisionNumber}
          workspaceId={workspaceId}
        />
      );
    }
  }
}

export function StudioShell({ workspaceId, initialMessages = [], initialSpec }: StudioShellProps) {
  const [panes, setPanes] = useState<StudioPanePair>(DEFAULT_STUDIO_PANES);

  const setLeft = useCallback((pane: StudioPaneId) => {
    setPanes((current) => assignStudioPane("left", pane, current));
  }, []);

  const setRight = useCallback((pane: StudioPaneId) => {
    setPanes((current) => assignStudioPane("right", pane, current));
  }, []);

  return (
    <ResizablePanelGroup
      className="bg-border flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"
      defaultLayout={{ "studio-left": 50, "studio-right": 50 }}
      orientation="horizontal"
    >
      <ResizablePanel
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        id="studio-left"
        minSize={25}
      >
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
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-3">
            <StudioPaneBody
              id={panes.left}
              initialMessages={initialMessages}
              initialSpec={initialSpec}
              workspaceId={workspaceId}
            />
          </div>
        </section>
      </ResizablePanel>

      <ResizableHandle className="border-border bg-border shrink-0 border-x" withHandle />

      <ResizablePanel
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        id="studio-right"
        minSize={25}
      >
        <section
          aria-label={`Right column: ${STUDIO_PANE_LABEL[panes.right]}`}
          className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <header className="border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <h2 className="text-foreground text-sm font-medium">
              {STUDIO_PANE_LABEL[panes.right]}
            </h2>
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
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-3">
            <StudioPaneBody
              id={panes.right}
              initialMessages={initialMessages}
              initialSpec={initialSpec}
              workspaceId={workspaceId}
            />
          </div>
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
