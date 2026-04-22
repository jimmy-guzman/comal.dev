"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import { StudioChat } from "@/components/studio/studio-chat";
import { StudioPlayground } from "@/components/studio/studio-playground";
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
import type { StudioSpecChatContext } from "@/lib/studio-spec-chat-context";

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
  getSpecChatContext,
  onSpecChatContextChange,
}: {
  id: StudioPaneId;
  workspaceId: string;
  initialMessages: UIMessage[];
  initialSpec: StudioShellInitialSpec;
  getSpecChatContext: () => StudioSpecChatContext;
  onSpecChatContextChange: (context: StudioSpecChatContext | null) => void;
}) {
  switch (id) {
    case "chat": {
      return (
        <StudioChat
          getSpecChatContext={getSpecChatContext}
          initialMessages={initialMessages}
          workspaceId={workspaceId}
        />
      );
    }
    case "playground": {
      return (
        <StudioPlayground
          specRevisionNumber={initialSpec.revisionNumber}
          workspaceId={workspaceId}
        />
      );
    }
    case "spec": {
      return (
        <StudioSpecEditor
          key={workspaceId}
          canEdit={initialSpec.canEdit}
          initialContent={initialSpec.content}
          initialRevisionNumber={initialSpec.revisionNumber}
          onChatContextChange={onSpecChatContextChange}
          workspaceId={workspaceId}
        />
      );
    }
  }
}

export function StudioShell({ workspaceId, initialMessages = [], initialSpec }: StudioShellProps) {
  const [panes, setPanes] = useState<StudioPanePair>(DEFAULT_STUDIO_PANES);
  const specChatContextRef = useRef<StudioSpecChatContext>({
    draftYaml: initialSpec.content,
    validating: false,
  });

  useEffect(() => {
    specChatContextRef.current = {
      draftYaml: initialSpec.content,
      validating: false,
    };
  }, [initialSpec.content, initialSpec.revisionNumber]);

  const onSpecChatContextChange = useCallback(
    (context: StudioSpecChatContext | null) => {
      if (context === null) {
        specChatContextRef.current = {
          draftYaml: initialSpec.content,
          validating: false,
        };
        return;
      }
      specChatContextRef.current = context;
    },
    [initialSpec.content],
  );

  const getSpecChatContext = useCallback(() => specChatContextRef.current, []);

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
              getSpecChatContext={getSpecChatContext}
              id={panes.left}
              initialMessages={initialMessages}
              initialSpec={initialSpec}
              onSpecChatContextChange={onSpecChatContextChange}
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
              getSpecChatContext={getSpecChatContext}
              id={panes.right}
              initialMessages={initialMessages}
              initialSpec={initialSpec}
              onSpecChatContextChange={onSpecChatContextChange}
              workspaceId={workspaceId}
            />
          </div>
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
