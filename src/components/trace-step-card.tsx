"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import type { TraceStep } from "@/lib/chat/trace";

import { JsonViewer } from "@/components/json-viewer";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatMicrodollars } from "@/lib/format-cost";
import { SUBAGENT_PREFIX } from "@/lib/subagent-prefix";
import { cn } from "@/lib/utils";

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;

  return `${(ms / 1000).toFixed(2)}s`;
};

const formatOffset = (ms: number) => {
  if (ms < 1000) return `+${ms}ms`;

  return `+${(ms / 1000).toFixed(1)}s`;
};

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "assistant": {
      return "default" as const;
    }
    case "user": {
      return "secondary" as const;
    }
    default: {
      return "outline" as const;
    }
  }
};

const eventLabel = (step: TraceStep) => {
  if (step.tool) {
    const name = step.tool.isSubagent
      ? step.tool.toolName.slice(SUBAGENT_PREFIX.length)
      : step.tool.toolName;

    return name;
  }

  switch (step.eventType) {
    case "assistant-turn-finish": {
      return "turn finish";
    }
    case "assistant-turn-start": {
      return "turn start";
    }
    case "file": {
      return "file";
    }
    case "memory-injected": {
      return "memory injected";
    }
    case "reasoning-segment": {
      return "reasoning";
    }
    case "source-url": {
      return "source";
    }
    case "text-segment": {
      return "text";
    }
    case "turn-aborted": {
      return "aborted";
    }
    case "turn-error": {
      return "error";
    }
    case "user-message": {
      return "user message";
    }
    default: {
      return step.eventType;
    }
  }
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "denied": {
      return "outline" as const;
    }
    case "error": {
      return "destructive" as const;
    }
    case "success": {
      return "secondary" as const;
    }
    default: {
      return "outline" as const;
    }
  }
};

const extractTextPreview = (payload: unknown): null | string => {
  if (typeof payload !== "object" || payload === null) return null;

  const p = payload as Record<string, unknown>;

  if (typeof p.text === "string") {
    const { text } = p;

    return text.length > 200 ? `${text.slice(0, 200)}...` : text;
  }

  if (typeof p.message === "string") return p.message;

  if (Array.isArray(p.hits)) {
    const hits = p.hits.filter((hit): hit is Record<string, unknown> => {
      return typeof hit === "object" && hit !== null;
    });

    if (hits.length > 0) {
      const summary = hits
        .map((hit) => {
          const content = typeof hit.content === "string" ? hit.content : "";
          const similarity = typeof hit.similarity === "number" ? hit.similarity.toFixed(2) : "?";

          return `${content} (${similarity})`;
        })
        .join(" · ");

      const prefix = `${hits.length} hit${hits.length === 1 ? "" : "s"}: `;
      const joined = prefix + summary;

      return joined.length > 200 ? `${joined.slice(0, 200)}...` : joined;
    }
  }

  if (Array.isArray(p.parts)) {
    const textParts = (p.parts as unknown[])
      .filter((part): part is Record<string, unknown> => {
        return typeof part === "object" && part !== null;
      })
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string);

    if (textParts.length > 0) {
      const joined = textParts.join(" ");

      return joined.length > 200 ? `${joined.slice(0, 200)}...` : joined;
    }
  }

  return null;
};

function ToolSection({ step }: { step: TraceStep }) {
  const [inputOpen, setInputOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  if (!step.tool) return null;

  return (
    <div className="flex flex-col gap-2">
      <Collapsible onOpenChange={setInputOpen} open={inputOpen}>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs">
          <ChevronRightIcon
            className={cn("size-3 transition-transform", inputOpen && "rotate-90")}
          />
          input
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1">
            <JsonViewer data={step.tool.input} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {step.tool.status === "success" && step.tool.output !== null && (
        <Collapsible onOpenChange={setOutputOpen} open={outputOpen}>
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs">
            <ChevronRightIcon
              className={cn("size-3 transition-transform", outputOpen && "rotate-90")}
            />
            output
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1">
              <JsonViewer data={step.tool.output} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {step.tool.status === "error" && step.tool.errorText && (
        <p className="text-destructive text-xs">{step.tool.errorText}</p>
      )}

      {step.tool.status === "denied" && (
        <p className="text-muted-foreground text-xs">tool call denied</p>
      )}
    </div>
  );
}

function TokenUsageDisplay({ step }: { step: TraceStep }) {
  if (!step.tokenUsage) return null;

  const parts: string[] = [];

  if (step.tokenUsage.inputTokens !== undefined) {
    parts.push(`input tokens: ${step.tokenUsage.inputTokens.toLocaleString()}`);
  }

  if (step.tokenUsage.outputTokens !== undefined) {
    parts.push(`output tokens: ${step.tokenUsage.outputTokens.toLocaleString()}`);
  }

  if (step.tokenUsage.totalTokens !== undefined) {
    parts.push(`total tokens: ${step.tokenUsage.totalTokens.toLocaleString()}`);
  }

  if (parts.length === 0) return null;

  return <span className="text-muted-foreground text-xs">{parts.join(" / ")}</span>;
}

function ChildTimeline({ children }: { children: TraceStep[] }) {
  if (children.length === 0) return null;

  return (
    <div className="border-muted mt-2 border-l-2 pl-3">
      <div className="flex flex-col gap-2">
        {children.map((child) => {
          return <TraceStepCard key={child.sequence} step={child} />;
        })}
      </div>
    </div>
  );
}

function RawPayloadSection({ payload }: { payload: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs">
        <ChevronRightIcon className={cn("size-3 transition-transform", open && "rotate-90")} />
        raw payload
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1">
          <JsonViewer data={payload} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TraceStepCard({ step }: { step: TraceStep }) {
  const textPreview = step.tool ? null : extractTextPreview(step.payload);
  const isError = step.eventType === "turn-error" || step.tool?.status === "error";

  return (
    <div
      className={cn(
        "flex gap-3 border-l-2 py-2 pl-3 pr-1",
        isError ? "border-destructive/50" : "border-muted",
      )}
    >
      <div className="w-16 shrink-0 pt-0.5 text-right">
        <span className="text-muted-foreground font-mono text-xs">
          {formatOffset(step.offsetMs)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={roleBadgeVariant(step.role)}>{step.role}</Badge>
          <Badge variant="outline">{eventLabel(step)}</Badge>

          {step.tool?.isSubagent && <Badge variant="outline">sub-agent</Badge>}

          {step.tool && step.tool.status !== "pending" && (
            <Badge variant={statusBadgeVariant(step.tool.status)}>{step.tool.status}</Badge>
          )}

          {step.modelId && <span className="text-muted-foreground text-xs">{step.modelId}</span>}

          {step.durationMs !== null && (
            <span className="text-muted-foreground font-mono text-xs">
              {formatDuration(step.durationMs)}
            </span>
          )}

          {step.costMicrodollars !== null && (
            <span className="text-muted-foreground font-mono text-xs">
              {formatMicrodollars(step.costMicrodollars)}
            </span>
          )}
        </div>

        {textPreview && <p className="text-muted-foreground line-clamp-3 text-xs">{textPreview}</p>}

        <TokenUsageDisplay step={step} />

        {step.tool && <ToolSection step={step} />}

        {!step.tool && <RawPayloadSection payload={step.payload} />}

        {step.children.length > 0 && <ChildTimeline>{step.children}</ChildTimeline>}
      </div>
    </div>
  );
}
