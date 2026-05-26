import type { DynamicToolUIPart, UIMessage } from "ai";

import type { ChatEventPayload, ChatEventType } from "./events";

import { chatErrorCopyFor } from "./errors";

export interface ChatEventRow {
  eventType: ChatEventType;
  messageId: null | string;
  parentToolCallId: null | string;
  payload: unknown;
  role: "assistant" | "system" | "user";
  sequence: number;
}

type AssistantPart = UIMessage["parts"][number];

interface ToolApproval {
  approved?: boolean;
  id: string;
  reason?: string;
}

interface ToolPartState {
  approval?: ToolApproval;
  errorText?: string;
  input?: unknown;
  output?: unknown;
  state:
    | "approval-requested"
    | "approval-responded"
    | "input-available"
    | "input-streaming"
    | "output-available"
    | "output-denied"
    | "output-error";
  toolCallId: string;
  toolName: string;
}

interface AssistantBuilder {
  id: string;
  parts: AssistantPart[];
  toolIndex: Map<string, number>;
  toolStates: Map<string, ToolPartState>;
}

const TOOL_STATE_RANK: Record<ToolPartState["state"], number> = {
  "approval-requested": 2,
  "approval-responded": 3,
  "input-available": 1,
  "input-streaming": 0,
  "output-available": 5,
  "output-denied": 4,
  "output-error": 5,
};

const toolPartFromState = (state: ToolPartState): DynamicToolUIPart => {
  const base = {
    toolCallId: state.toolCallId,
    toolName: state.toolName,
    type: "dynamic-tool",
  } as const;

  switch (state.state) {
    case "approval-requested": {
      return {
        ...base,
        approval: { id: state.approval?.id ?? "" },
        input: state.input,
        state: "approval-requested",
      };
    }
    case "approval-responded": {
      return {
        ...base,
        approval: {
          approved: state.approval?.approved ?? false,
          id: state.approval?.id ?? "",
          reason: state.approval?.reason,
        },
        input: state.input,
        state: "approval-responded",
      };
    }
    case "input-available": {
      return { ...base, input: state.input, state: "input-available" };
    }
    case "input-streaming": {
      return { ...base, input: state.input, state: "input-streaming" };
    }
    case "output-available": {
      const approved =
        state.approval?.approved === true
          ? {
              approval: {
                approved: true as const,
                id: state.approval.id,
                reason: state.approval.reason,
              },
            }
          : {};

      return {
        ...base,
        ...approved,
        input: state.input,
        output: state.output,
        state: "output-available",
      };
    }
    case "output-denied": {
      return {
        ...base,
        approval: {
          approved: false,
          id: state.approval?.id ?? "",
          reason: state.approval?.reason,
        },
        input: state.input,
        state: "output-denied",
      };
    }
    case "output-error": {
      const approved =
        state.approval?.approved === true
          ? {
              approval: {
                approved: true as const,
                id: state.approval.id,
                reason: state.approval.reason,
              },
            }
          : {};

      return {
        ...base,
        ...approved,
        errorText: state.errorText ?? "",
        input: state.input,
        state: "output-error",
      };
    }
    default: {
      const exhaustive: never = state.state;

      throw new Error(`Unhandled tool part state: ${String(exhaustive)}`);
    }
  }
};

const advanceToolState = (prev: ToolPartState, next: ToolPartState): ToolPartState => {
  const winner = TOOL_STATE_RANK[next.state] >= TOOL_STATE_RANK[prev.state] ? next : prev;
  const loser = winner === next ? prev : next;

  return {
    approval: winner.approval ?? loser.approval,
    errorText: winner.errorText ?? loser.errorText,
    input: winner.input ?? loser.input,
    output: winner.output ?? loser.output,
    state: winner.state,
    toolCallId: winner.toolCallId,
    toolName: winner.toolName,
  };
};

const upsertToolPart = (builder: AssistantBuilder, next: ToolPartState): void => {
  const existing = builder.toolStates.get(next.toolCallId);
  const merged = existing ? advanceToolState(existing, next) : next;

  builder.toolStates.set(next.toolCallId, merged);

  const part = toolPartFromState(merged);
  const existingIndex = builder.toolIndex.get(next.toolCallId);

  if (existingIndex === undefined) {
    builder.toolIndex.set(next.toolCallId, builder.parts.length);
    builder.parts.push(part);
  } else {
    builder.parts.splice(existingIndex, 1, part);
  }
};

const appendUserMessage = (
  messages: UIMessage[],
  row: ChatEventRow,
  payload: ChatEventPayload<"user-message">,
): void => {
  messages.push({
    id: row.messageId ?? `user-${row.sequence}`,
    parts: payload.parts as UIMessage["parts"],
    role: "user",
  });
};

const startAssistantMessage = (
  messages: UIMessage[],
  builders: Map<string, AssistantBuilder>,
  row: ChatEventRow,
): AssistantBuilder => {
  const id = row.messageId ?? `assistant-${row.sequence}`;
  const existing = builders.get(id);

  if (existing) return existing;

  const builder: AssistantBuilder = {
    id,
    parts: [],
    toolIndex: new Map(),
    toolStates: new Map(),
  };

  builders.set(id, builder);
  messages.push({ id, parts: builder.parts, role: "assistant" });

  return builder;
};

const getOrStartAssistantBuilder = (
  messages: UIMessage[],
  builders: Map<string, AssistantBuilder>,
  row: ChatEventRow,
): AssistantBuilder => {
  if (row.messageId !== null) {
    const existing = builders.get(row.messageId);

    if (existing) return existing;
  }

  return startAssistantMessage(messages, builders, row);
};

const collapseConsecutiveStepStarts = (parts: AssistantPart[]): AssistantPart[] => {
  const out: AssistantPart[] = [];

  for (const part of parts) {
    const last = out.at(-1);

    if (part.type === "step-start" && last?.type === "step-start") continue;

    out.push(part);
  }

  return out;
};

const finalizeMessages = (messages: UIMessage[]): UIMessage[] => {
  return messages
    .map((message) => {
      if (message.role !== "assistant") return message;

      const parts = collapseConsecutiveStepStarts(message.parts);

      const trimmed: AssistantPart[] = [];

      for (const part of parts) {
        if (part.type === "step-start" && trimmed.length === 0) continue;

        trimmed.push(part);
      }

      while (trimmed.at(-1)?.type === "step-start") {
        trimmed.pop();
      }

      return { ...message, parts: trimmed };
    })
    .filter((message) => message.parts.length > 0 || message.role === "user");
};

export type SubagentTraces = Record<string, UIMessage[]>;

export const projectMessages = (events: ChatEventRow[]): UIMessage[] => {
  const messages: UIMessage[] = [];
  const assistantBuilders = new Map<string, AssistantBuilder>();
  const toolOwners = new Map<string, AssistantBuilder>();
  const getToolOwner = (toolCallId: string, row: ChatEventRow): AssistantBuilder => {
    const existing = toolOwners.get(toolCallId);

    if (existing) return existing;

    const owner = getOrStartAssistantBuilder(messages, assistantBuilders, row);

    toolOwners.set(toolCallId, owner);

    return owner;
  };
  const sorted = events.toSorted((a, b) => a.sequence - b.sequence);

  for (const row of sorted) {
    const payload = row.payload as ChatEventPayload<typeof row.eventType>;

    switch (row.eventType) {
      case "user-message": {
        appendUserMessage(messages, row, payload as ChatEventPayload<"user-message">);
        continue;
      }

      case "assistant-turn-start": {
        startAssistantMessage(messages, assistantBuilders, row);
        continue;
      }

      case "assistant-turn-finish":
      case "memory-injected":
      case "turn-aborted": {
        continue;
      }

      case "turn-error": {
        const builder = getOrStartAssistantBuilder(messages, assistantBuilders, row);
        const errorPayload = payload as ChatEventPayload<"turn-error">;
        const info = chatErrorCopyFor(errorPayload.kind ?? "unknown");

        builder.parts.push({
          data: {
            kind: info.kind,
            message: info.message,
            originalMessage: errorPayload.message,
            retryable: info.retryable,
            statusCode: errorPayload.statusCode,
            suggestModelSwitch: info.suggestModelSwitch,
            title: info.title,
          },
          id: `error-${row.sequence}`,
          type: "data-error",
        });
        continue;
      }

      case "text-segment": {
        const builder = getOrStartAssistantBuilder(messages, assistantBuilders, row);
        const segment = payload as ChatEventPayload<"text-segment">;

        builder.parts.push({ state: "done", text: segment.text, type: "text" });
        continue;
      }

      case "reasoning-segment": {
        const builder = getOrStartAssistantBuilder(messages, assistantBuilders, row);
        const segment = payload as ChatEventPayload<"reasoning-segment">;

        builder.parts.push({ state: "done", text: segment.text, type: "reasoning" });
        continue;
      }

      case "step-boundary": {
        const builder = getOrStartAssistantBuilder(messages, assistantBuilders, row);

        builder.parts.push({ type: "step-start" });
        continue;
      }

      case "tool-input-complete": {
        const tool = payload as ChatEventPayload<"tool-input-complete">;
        const builder = getToolOwner(tool.toolCallId, row);

        upsertToolPart(builder, {
          input: tool.input,
          state: "input-available",
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
        });
        continue;
      }

      case "tool-approval-requested": {
        const tool = payload as ChatEventPayload<"tool-approval-requested">;
        const builder = getToolOwner(tool.toolCallId, row);

        upsertToolPart(builder, {
          approval: tool.approval,
          input: tool.input,
          state: "approval-requested",
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
        });
        continue;
      }

      case "tool-approval-responded": {
        const tool = payload as ChatEventPayload<"tool-approval-responded">;
        const builder = getToolOwner(tool.toolCallId, row);

        upsertToolPart(builder, {
          approval: { ...tool.approval, approved: tool.approved },
          state: "approval-responded",
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
        });
        continue;
      }

      case "tool-output-available": {
        const tool = payload as ChatEventPayload<"tool-output-available">;
        const builder = getToolOwner(tool.toolCallId, row);

        upsertToolPart(builder, {
          output: tool.output,
          state: "output-available",
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
        });
        continue;
      }

      case "tool-output-error": {
        const tool = payload as ChatEventPayload<"tool-output-error">;
        const builder = getToolOwner(tool.toolCallId, row);

        upsertToolPart(builder, {
          errorText: tool.errorText,
          state: "output-error",
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
        });
        continue;
      }

      case "tool-output-denied": {
        const tool = payload as ChatEventPayload<"tool-output-denied">;
        const builder = getToolOwner(tool.toolCallId, row);

        upsertToolPart(builder, {
          state: "output-denied",
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
        });
        continue;
      }

      case "file": {
        const builder = getOrStartAssistantBuilder(messages, assistantBuilders, row);
        const file = payload as ChatEventPayload<"file">;

        builder.parts.push({
          filename: file.filename,
          mediaType: file.mediaType,
          type: "file",
          url: file.url,
        });
        continue;
      }

      case "source-url": {
        const builder = getOrStartAssistantBuilder(messages, assistantBuilders, row);
        const source = payload as ChatEventPayload<"source-url">;

        builder.parts.push({
          sourceId: source.sourceId,
          title: source.title,
          type: "source-url",
          url: source.url,
        });
        continue;
      }

      default: {
        continue;
      }
    }
  }

  return finalizeMessages(messages);
};

export const projectSubagentTraces = (events: ChatEventRow[]): SubagentTraces => {
  const grouped = new Map<string, ChatEventRow[]>();

  for (const row of events) {
    if (row.parentToolCallId === null) continue;

    const group = grouped.get(row.parentToolCallId);

    if (group) {
      group.push(row);
    } else {
      grouped.set(row.parentToolCallId, [row]);
    }
  }

  const traces: SubagentTraces = {};

  for (const [toolCallId, group] of grouped) {
    traces[toolCallId] = projectMessages(group);
  }

  return traces;
};
