"use client";

import { ChevronDownIcon, GitCompareIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { AgentVersionRow } from "@/lib/agents";

import { revertAgentVersionAction } from "@/actions/revert-agent-version";
import { AgentVersionDiffDialog } from "@/components/agent-version-diff-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Props {
  agentId: string;
  versions: AgentVersionRow[];
}

const DIVISIONS = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.345_24, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" },
] as const satisfies readonly { amount: number; name: Intl.RelativeTimeFormatUnit }[];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const formatRelative = (date: Date) => {
  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.name);
    }

    duration /= division.amount;
  }

  return relativeTimeFormatter.format(Math.round(duration), "years");
};

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
  onCompare: () => void;
  previous: AgentVersionRow | undefined;
  version: AgentVersionRow;
}

const VersionRowItem = ({ agentId, onCompare, previous, version }: VersionRowItemProps) => {
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
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{formatRelative(version.createdAt)}</span>
          <span className="text-muted-foreground text-xs">{version.creatorName}</span>
        </div>
        <span className="text-muted-foreground text-xs">{summary}</span>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button aria-label="compare this version" onClick={onCompare} size="sm" variant="ghost">
          <GitCompareIcon className="size-3.5" />
          compare
        </Button>
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
    </div>
  );
};

export const AgentVersionHistory = ({ agentId, versions }: Props) => {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBaseId, setDialogBaseId] = useState("");
  const [dialogTargetId, setDialogTargetId] = useState("");

  const openDiff = (targetIdx: number) => {
    const target = versions.at(targetIdx);
    const base = versions.at(targetIdx + 1) ?? versions.at(targetIdx);

    if (!target || !base) return;

    setDialogTargetId(target.id);
    setDialogBaseId(base.id);
    setDialogOpen(true);
  };

  return (
    <>
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
              return <VersionRowItem
                  agentId={agentId}
                  key={version.id}
                  onCompare={() => {
                    openDiff(idx);
                  }}
                  previous={versions[idx + 1]}
                  version={version}
                />;
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {dialogBaseId && dialogTargetId ? (
        <AgentVersionDiffDialog
          agentId={agentId}
          defaultBaseId={dialogBaseId}
          defaultTargetId={dialogTargetId}
          onOpenChange={setDialogOpen}
          open={dialogOpen}
          versions={versions}
        />
      ) : null}
    </>
  );
};
