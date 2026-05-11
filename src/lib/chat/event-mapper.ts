import type { TextStreamPart, ToolSet } from "ai";

import type { ChatEventInput, ChatEventType } from "./events";

import { classifyChatError } from "./errors";

interface SegmentBuffer {
  reasoning: Map<string, string>;
  text: Map<string, string>;
}

export interface MapStreamPartContext {
  buffer: SegmentBuffer;
  messageId: string;
  modelId: null | string;
  toolStartTimes: Map<string, Date>;
}

const TURN_START_KEY = "__turn__";

export const createSegmentBuffer = (): SegmentBuffer => {
  return { reasoning: new Map(), text: new Map() };
};

const stringifyError = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  if (error === null || error === undefined) return "Unknown error";

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

export const mapStreamPartToEvent = (
  part: TextStreamPart<ToolSet>,
  ctx: MapStreamPartContext,
): ChatEventInput | null => {
  switch (part.type) {
    case "abort": {
      return {
        eventType: "turn-aborted" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: { reason: part.reason },
        role: "assistant",
      };
    }

    case "error": {
      const info = classifyChatError(part.error);

      return {
        eventType: "turn-error" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: {
          kind: info.kind,
          message: stringifyError(part.error),
          statusCode: info.statusCode,
        },
        role: "assistant",
      };
    }

    case "file": {
      const file = part.file as { mediaType?: string; url?: string };

      if (typeof file.url !== "string" || typeof file.mediaType !== "string") return null;

      return {
        eventType: "file" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: {
          mediaType: file.mediaType,
          url: file.url,
        },
        role: "assistant",
      };
    }

    case "finish": {
      return {
        endedAt: new Date(),
        eventType: "assistant-turn-finish" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: { finishReason: part.finishReason, totalUsage: part.totalUsage },
        role: "assistant",
        startedAt: ctx.toolStartTimes.get(TURN_START_KEY),
      };
    }

    case "finish-step": {
      return null;
    }

    case "raw": {
      return null;
    }

    case "reasoning-delta": {
      const prev = ctx.buffer.reasoning.get(part.id) ?? "";

      ctx.buffer.reasoning.set(part.id, prev + part.text);

      return null;
    }
    case "reasoning-end": {
      const text = ctx.buffer.reasoning.get(part.id) ?? "";

      ctx.buffer.reasoning.delete(part.id);

      if (text.length === 0) return null;

      return {
        eventType: "reasoning-segment" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: { segmentId: part.id, text },
        role: "assistant",
      };
    }
    case "reasoning-start": {
      ctx.buffer.reasoning.set(part.id, "");

      return null;
    }

    case "source": {
      if (!("url" in part) || typeof part.url !== "string") return null;

      const sourceId = "id" in part && typeof part.id === "string" ? part.id : part.url;
      const title = "title" in part && typeof part.title === "string" ? part.title : undefined;

      return {
        eventType: "source-url" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: { sourceId, title, url: part.url },
        role: "assistant",
      };
    }

    case "start": {
      const startedAt = new Date();

      ctx.toolStartTimes.set(TURN_START_KEY, startedAt);

      return {
        eventType: "assistant-turn-start" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: { modelId: ctx.modelId },
        role: "assistant",
        startedAt,
      };
    }

    case "start-step": {
      return {
        eventType: "step-boundary" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: {},
        role: "assistant",
        startedAt: new Date(),
      };
    }

    case "text-delta": {
      const prev = ctx.buffer.text.get(part.id) ?? "";

      ctx.buffer.text.set(part.id, prev + part.text);

      return null;
    }

    case "text-end": {
      const text = ctx.buffer.text.get(part.id) ?? "";

      ctx.buffer.text.delete(part.id);

      if (text.length === 0) return null;

      return {
        eventType: "text-segment" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: { segmentId: part.id, text },
        role: "assistant",
      };
    }

    case "text-start": {
      ctx.buffer.text.set(part.id, "");

      return null;
    }

    case "tool-approval-request": {
      return {
        eventType: "tool-approval-requested" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: {
          approval: { id: part.approvalId },
          input: part.toolCall.input,
          toolCallId: part.toolCall.toolCallId,
          toolName: part.toolCall.toolName,
        },
        role: "assistant",
      };
    }

    case "tool-call": {
      const dynamic = "dynamic" in part ? Boolean(part.dynamic) : undefined;
      const startedAt = new Date();

      ctx.toolStartTimes.set(part.toolCallId, startedAt);

      return {
        eventType: "tool-input-complete" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: {
          dynamic,
          input: part.input,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
        },
        role: "assistant",
        startedAt,
      };
    }

    case "tool-error": {
      const startedAt = ctx.toolStartTimes.get(part.toolCallId);

      ctx.toolStartTimes.delete(part.toolCallId);

      return {
        endedAt: new Date(),
        eventType: "tool-output-error" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: {
          errorText: stringifyError(part.error),
          toolCallId: part.toolCallId,
          toolName: part.toolName,
        },
        role: "assistant",
        startedAt,
      };
    }
    case "tool-input-delta":
    case "tool-input-end":
    case "tool-input-start": {
      return null;
    }

    case "tool-output-denied": {
      const startedAt = ctx.toolStartTimes.get(part.toolCallId);

      ctx.toolStartTimes.delete(part.toolCallId);

      return {
        endedAt: new Date(),
        eventType: "tool-output-denied" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: {
          reason: "reason" in part && typeof part.reason === "string" ? part.reason : undefined,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
        },
        role: "assistant",
        startedAt,
      };
    }

    case "tool-result": {
      const preliminary = part.preliminary === true ? true : undefined;
      const isFinal = preliminary !== true;
      const startedAt = ctx.toolStartTimes.get(part.toolCallId);

      if (isFinal) {
        ctx.toolStartTimes.delete(part.toolCallId);
      }

      return {
        endedAt: isFinal ? new Date() : undefined,
        eventType: "tool-output-available" satisfies ChatEventType,
        messageId: ctx.messageId,
        payload: {
          output: part.output,
          preliminary,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
        },
        role: "assistant",
        startedAt: isFinal ? startedAt : undefined,
      };
    }

    default: {
      return null;
    }
  }
};
