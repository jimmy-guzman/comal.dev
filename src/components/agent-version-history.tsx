"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { AgentVersionRow } from "@/lib/agents";

import { revertAgentVersionAction } from "@/actions/revert-agent-version";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatRelative } from "@/lib/format-relative";

interface Props {
  agentId: string;
  versions: AgentVersionRow[];
}

const buildSummary = (version: AgentVersionRow, previous: AgentVersionRow | undefined) => {
  if (!previous) return "initial version";

  const parts: string[] = [];

  if (version.modelId !== previous.modelId) {
    const prev = previous.modelId.split("/").at(-1) ?? previous.modelId;
    const curr = version.modelId.split("/").at(-1) ?? version.modelId;

    parts.push(`model: ${prev} → ${curr}`);
  }

  const toolDelta = version.tools.length - previous.tools.length;

  if (toolDelta !== 0) {
    parts.push(`tools: ${toolDelta > 0 ? "+" : ""}${toolDelta}`);
  }

  const promptDelta = version.systemPrompt.length - previous.systemPrompt.length;

  if (promptDelta !== 0) {
    parts.push(`prompt: ${promptDelta > 0 ? "+" : ""}${promptDelta} chars`);
  }

  return parts.length > 0 ? parts.join(" · ") : "no changes";
};

interface VersionRowItemProps {
  agentId: string;
  isExpanded: boolean;
  onToggle: () => void;
  previous: AgentVersionRow | undefined;
  version: AgentVersionRow;
}

const VersionRowItem = ({
  agentId,
  isExpanded,
  onToggle,
  previous,
  version,
}: VersionRowItemProps) => {
  const router = useRouter();

  const { execute: revert, isPending } = useAction(revertAgentVersionAction, {
    onError: ({ error }) => {
      toast.error(error.serverError ?? "failed to revert agent.");
    },
    onSuccess: () => {
      toast.success("reverted to selected version.");
      router.refresh();
    },
  });

  const summary = buildSummary(version, previous);

  return (
    <div className="py-2">
      <div className="flex items-start justify-between gap-4">
        <button
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
          onClick={onToggle}
          type="button"
        >
          <ChevronRightIcon
            className={`text-muted-foreground mt-0.5 size-3 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{formatRelative(version.createdAt)}</span>
              <span className="text-muted-foreground text-xs">{version.creatorName}</span>
            </div>
            <span className="text-muted-foreground text-xs">{summary}</span>
          </div>
        </button>
        <Button
          disabled={isPending}
          onClick={() => {
            revert({ agentId, versionId: version.id });
          }}
          size="sm"
          variant="ghost"
        >
          {isPending ? "reverting..." : "revert"}
        </Button>
      </div>
      {isExpanded ? (
        <div className="mt-2 ml-4 flex flex-col gap-2">
          <pre className="bg-muted overflow-x-auto rounded p-3 text-xs whitespace-pre-wrap">
            {version.systemPrompt}
          </pre>
          <p className="text-muted-foreground text-xs">
            model: {version.modelId}
            {version.tools.length > 0
              ? ` · tools: ${version.tools.map((t) => t.toolId).join(", ")}`
              : null}
            {version.subAgents.length > 0
              ? ` · sub-agents: ${version.subAgents.map((s) => s.alias).join(", ")}`
              : null}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export const AgentVersionHistory = ({ agentId, versions }: Props) => {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<null | string>(null);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger asChild>
        <Button className="gap-2 px-0" size="sm" variant="ghost">
          <ChevronDownIcon
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span className="text-xs">
            {versions.length} {versions.length === 1 ? "version" : "versions"}
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y">
          {versions.map((version, idx) => {
            return (
              <VersionRowItem
                agentId={agentId}
                isExpanded={expandedId === version.id}
                key={version.id}
                onToggle={() => {
                  setExpandedId(expandedId === version.id ? null : version.id);
                }}
                previous={versions[idx + 1]}
                version={version}
              />
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
