import { SUBAGENT_PREFIX } from "@/lib/subagent-prefix";

import type { TraceEventRow } from "./store";

export interface TraceStep {
  children: TraceStep[];
  costMicrodollars: null | number;
  durationMs: null | number;
  endedAt: Date | null;
  eventType: string;
  modelId: null | string;
  offsetMs: number;
  payload: unknown;
  role: string;
  sequence: number;
  startedAt: Date | null;
  tokenUsage: null | TraceTokenUsage;
  tool: null | TraceTool;
}

interface TraceTool {
  errorText: null | string;
  input: unknown;
  isSubagent: boolean;
  output: unknown;
  status: "denied" | "error" | "pending" | "success";
  toolCallId: string;
  toolName: string;
}

interface TraceTokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

type ToolAccumulator = Map<
  string,
  { errorText?: string; input?: unknown; isSubagent: boolean; output?: unknown; toolName: string }
>;

const computeOffset = (event: TraceEventRow, conversationStart: Date) => {
  const ref = event.startedAt ?? event.createdAt;

  return ref.getTime() - conversationStart.getTime();
};

const computeDuration = (event: TraceEventRow) => {
  if (event.startedAt && event.endedAt) {
    return event.endedAt.getTime() - event.startedAt.getTime();
  }

  return null;
};

const parseTokenUsage = (payload: unknown): null | TraceTokenUsage => {
  if (typeof payload !== "object" || payload === null) return null;

  const p = payload as Record<string, unknown>;

  if (p.totalUsage === undefined || p.totalUsage === null) return null;

  const usage = p.totalUsage;

  if (typeof usage !== "object") return null;

  const u = usage as Record<string, unknown>;

  return {
    completionTokens: typeof u.completionTokens === "number" ? u.completionTokens : undefined,
    promptTokens: typeof u.promptTokens === "number" ? u.promptTokens : undefined,
    totalTokens: typeof u.totalTokens === "number" ? u.totalTokens : undefined,
  };
};

const buildToolFromAccumulator = (
  toolCallId: string,
  acc: {
    errorText?: string;
    input?: unknown;
    isSubagent: boolean;
    output?: unknown;
    toolName: string;
  },
): TraceTool => {
  const status = acc.errorText
    ? ("error" as const)
    : acc.output === undefined
      ? ("pending" as const)
      : ("success" as const);

  return {
    errorText: acc.errorText ?? null,
    input: acc.input,
    isSubagent: acc.isSubagent,
    output: acc.output ?? null,
    status,
    toolCallId,
    toolName: acc.toolName,
  };
};

const projectStepsFromEvents = (events: TraceEventRow[], conversationStart: Date): TraceStep[] => {
  const steps: TraceStep[] = [];
  const toolAcc: ToolAccumulator = new Map();
  const toolStepIndex = new Map<string, number>();

  for (const event of events) {
    const payload =
      typeof event.payload === "object" && event.payload !== null
        ? (event.payload as Record<string, unknown>)
        : {};
    const toolCallId = typeof payload.toolCallId === "string" ? payload.toolCallId : null;

    switch (event.eventType) {
      case "step-boundary": {
        break;
      }

      case "tool-approval-requested": {
        break;
      }

      case "tool-approval-responded": {
        break;
      }

      case "tool-input-complete": {
        if (toolCallId === null) break;

        const toolName = typeof payload.toolName === "string" ? payload.toolName : "unknown";
        const isSubagent = toolName.startsWith(SUBAGENT_PREFIX);
        const toolData = {
          input: payload.input,
          isSubagent,
          toolName,
        };

        toolAcc.set(toolCallId, toolData);

        const step: TraceStep = {
          children: [],
          costMicrodollars: event.costMicrodollars,
          durationMs: null,
          endedAt: null,
          eventType: event.eventType,
          modelId: event.modelId,
          offsetMs: computeOffset(event, conversationStart),
          payload: event.payload,
          role: event.role,
          sequence: event.sequence,
          startedAt: event.startedAt,
          tokenUsage: null,
          tool: buildToolFromAccumulator(toolCallId, toolData),
        };

        toolStepIndex.set(toolCallId, steps.length);
        steps.push(step);

        break;
      }

      case "tool-output-available": {
        if (toolCallId === null) break;

        const acc = toolAcc.get(toolCallId);

        if (acc) {
          acc.output = payload.output;
        }

        const idx = toolStepIndex.get(toolCallId);

        if (idx !== undefined) {
          const step = steps[idx];
          const toolData = toolAcc.get(toolCallId);

          if (toolData) {
            step.durationMs = computeDuration(event);
            step.endedAt = event.endedAt;
            step.tool = buildToolFromAccumulator(toolCallId, toolData);
          }
        }

        break;
      }
      case "tool-output-denied": {
        if (toolCallId === null) break;

        const idx = toolStepIndex.get(toolCallId);

        if (idx !== undefined) {
          const step = steps[idx];

          if (step.tool) {
            step.tool.status = "denied";
            step.durationMs = computeDuration(event);
            step.endedAt = event.endedAt;
          }
        }

        break;
      }
      case "tool-output-error": {
        if (toolCallId === null) break;

        const acc = toolAcc.get(toolCallId);

        if (acc) {
          acc.errorText =
            typeof payload.errorText === "string" ? payload.errorText : "unknown error";
        }

        const idx = toolStepIndex.get(toolCallId);

        if (idx !== undefined) {
          const step = steps[idx];
          const toolData = toolAcc.get(toolCallId);

          if (toolData) {
            step.durationMs = computeDuration(event);
            step.endedAt = event.endedAt;
            step.tool = buildToolFromAccumulator(toolCallId, toolData);
          }
        }

        break;
      }

      default: {
        steps.push({
          children: [],
          costMicrodollars: event.costMicrodollars,
          durationMs: computeDuration(event),
          endedAt: event.endedAt,
          eventType: event.eventType,
          modelId: event.modelId,
          offsetMs: computeOffset(event, conversationStart),
          payload: event.payload,
          role: event.role,
          sequence: event.sequence,
          startedAt: event.startedAt,
          tokenUsage:
            event.eventType === "assistant-turn-finish" ? parseTokenUsage(event.payload) : null,
          tool: null,
        });
      }
    }
  }

  return steps;
};

export const projectTrace = (events: TraceEventRow[], conversationStart: Date): TraceStep[] => {
  const topLevel = events.filter((e) => e.parentToolCallId === null);
  const childGroups = new Map<string, TraceEventRow[]>();

  for (const event of events) {
    if (event.parentToolCallId === null) continue;

    const group = childGroups.get(event.parentToolCallId);

    if (group) {
      group.push(event);
    } else {
      childGroups.set(event.parentToolCallId, [event]);
    }
  }

  const steps = projectStepsFromEvents(topLevel, conversationStart);

  for (const step of steps) {
    if (step.tool === null) continue;

    const children = childGroups.get(step.tool.toolCallId);

    if (children) {
      step.children = projectStepsFromEvents(children, conversationStart);
    }
  }

  return steps;
};
