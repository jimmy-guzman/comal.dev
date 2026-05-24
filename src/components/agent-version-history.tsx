"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { AgentVersionRow } from "@/lib/agents";

import { revertAgentVersionAction } from "@/actions/revert-agent-version";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { formatRelative } from "@/lib/format-relative";
import { cn } from "@/lib/utils";

interface Props {
  agentId: string;
  readOnly?: boolean;
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

  const evalDelta = version.evals.length - previous.evals.length;

  if (evalDelta !== 0) {
    parts.push(`evals: ${evalDelta > 0 ? "+" : ""}${evalDelta}`);
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

interface VersionNodeProps {
  agentId: string;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  previous: AgentVersionRow | undefined;
  readOnly: boolean;
  version: AgentVersionRow;
}

const VersionNode = ({
  agentId,
  isExpanded,
  isFirst,
  isLast,
  onToggle,
  previous,
  readOnly,
  version,
}: VersionNodeProps) => {
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
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            isFirst ? "bg-primary" : "bg-border",
          )}
        />
        {isLast ? null : <div className="bg-border w-px flex-1" />}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 pb-6">
        <div className="flex items-center justify-between gap-2">
          <button
            className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
            onClick={onToggle}
            type="button"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{formatRelative(version.createdAt)}</span>
              <span className="text-muted-foreground text-xs">{version.creatorName}</span>
            </div>
            <span className="text-muted-foreground text-xs">{summary}</span>
          </button>
          {readOnly ? null : (
            <Button
              disabled={isPending}
              onClick={() => {
                revert({ agentId, versionId: version.id });
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {isPending ? "reverting..." : "revert"}
            </Button>
          )}
        </div>

        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            <div className="mt-2 flex flex-col gap-3">
              <Card size="sm">
                <CardContent>
                  <pre className="max-h-40 overflow-y-auto text-xs whitespace-pre-wrap">
                    {version.systemPrompt || "(empty prompt)"}
                  </pre>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {version.modelId.split("/").at(-1) ?? version.modelId}
                </span>
                {version.tools.length > 0 ? (
                  <>
                    <span className="text-muted-foreground text-xs">·</span>
                    {version.tools.map((t) => {
                      return (
                        <Badge key={t.toolId} variant="secondary">
                          {t.toolId}
                        </Badge>
                      );
                    })}
                  </>
                ) : null}
                {version.subAgents.length > 0 ? (
                  <>
                    <span className="text-muted-foreground text-xs">·</span>
                    {version.subAgents.map((s) => {
                      return (
                        <Badge key={s.alias} variant="secondary">
                          {s.alias}
                        </Badge>
                      );
                    })}
                  </>
                ) : null}
                {version.evals.length > 0 ? (
                  <>
                    <span className="text-muted-foreground text-xs">·</span>
                    {version.evals.map((e) => {
                      return (
                        <Badge key={e.name} variant="secondary">
                          {e.name}
                        </Badge>
                      );
                    })}
                  </>
                ) : null}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export const AgentVersionHistory = ({ agentId, readOnly = false, versions }: Props) => {
  const [expandedId, setExpandedId] = useState<null | string>(null);

  return (
    <div className="flex flex-col">
      {versions.map((version, idx) => {
        return (
          <VersionNode
            agentId={agentId}
            isExpanded={expandedId === version.id}
            isFirst={idx === 0}
            isLast={idx === versions.length - 1}
            key={version.id}
            onToggle={() => {
              setExpandedId(expandedId === version.id ? null : version.id);
            }}
            previous={versions[idx + 1]}
            readOnly={readOnly}
            version={version}
          />
        );
      })}
    </div>
  );
};
