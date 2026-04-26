import { z } from "zod";

const approvalSchema = z.object({
  approved: z.boolean().optional(),
  id: z.string(),
  reason: z.string().optional(),
});

const userMessagePayloadSchema = z.object({
  parts: z.array(z.unknown()),
});

const assistantTurnStartPayloadSchema = z.object({
  modelId: z.string().nullable(),
});

const assistantTurnFinishPayloadSchema = z.object({
  finishReason: z.string().optional(),
  totalUsage: z.unknown().optional(),
});

const textSegmentPayloadSchema = z.object({
  segmentId: z.string(),
  text: z.string(),
});

const reasoningSegmentPayloadSchema = z.object({
  segmentId: z.string(),
  text: z.string(),
});

const stepBoundaryPayloadSchema = z.looseObject({});

const toolInputCompletePayloadSchema = z.object({
  dynamic: z.boolean().optional(),
  input: z.unknown(),
  toolCallId: z.string(),
  toolName: z.string(),
});

const toolOutputAvailablePayloadSchema = z.object({
  output: z.unknown(),
  toolCallId: z.string(),
  toolName: z.string(),
});

const toolOutputErrorPayloadSchema = z.object({
  errorText: z.string(),
  toolCallId: z.string(),
  toolName: z.string(),
});

const toolOutputDeniedPayloadSchema = z.object({
  reason: z.string().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
});

const toolApprovalRequestedPayloadSchema = z.object({
  approval: approvalSchema,
  input: z.unknown(),
  toolCallId: z.string(),
  toolName: z.string(),
});

const toolApprovalRespondedPayloadSchema = z.object({
  approval: approvalSchema,
  approved: z.boolean(),
  toolCallId: z.string(),
  toolName: z.string(),
});

const filePayloadSchema = z.object({
  filename: z.string().optional(),
  mediaType: z.string(),
  url: z.string(),
});

const sourceUrlPayloadSchema = z.object({
  sourceId: z.string(),
  title: z.string().optional(),
  url: z.string(),
});

const turnAbortedPayloadSchema = z.object({
  reason: z.string().optional(),
});

const chatErrorKindSchema = z.enum([
  "auth",
  "context-length",
  "model-unavailable",
  "network",
  "rate-limit",
  "unknown",
]);

const turnErrorPayloadSchema = z.object({
  kind: chatErrorKindSchema.optional(),
  message: z.string(),
  statusCode: z.number().int().optional(),
});

const EVENT_PAYLOAD_SCHEMAS = {
  "assistant-turn-finish": assistantTurnFinishPayloadSchema,
  "assistant-turn-start": assistantTurnStartPayloadSchema,
  file: filePayloadSchema,
  "reasoning-segment": reasoningSegmentPayloadSchema,
  "source-url": sourceUrlPayloadSchema,
  "step-boundary": stepBoundaryPayloadSchema,
  "text-segment": textSegmentPayloadSchema,
  "tool-approval-requested": toolApprovalRequestedPayloadSchema,
  "tool-approval-responded": toolApprovalRespondedPayloadSchema,
  "tool-input-complete": toolInputCompletePayloadSchema,
  "tool-output-available": toolOutputAvailablePayloadSchema,
  "tool-output-denied": toolOutputDeniedPayloadSchema,
  "tool-output-error": toolOutputErrorPayloadSchema,
  "turn-aborted": turnAbortedPayloadSchema,
  "turn-error": turnErrorPayloadSchema,
  "user-message": userMessagePayloadSchema,
} as const satisfies Record<string, z.ZodType>;

export type ChatEventType = keyof typeof EVENT_PAYLOAD_SCHEMAS;

export type ChatEventPayload<T extends ChatEventType> = z.infer<(typeof EVENT_PAYLOAD_SCHEMAS)[T]>;

export interface ChatEventInput<T extends ChatEventType = ChatEventType> {
  eventType: T;
  messageId: null | string;
  payload: ChatEventPayload<T>;
  role: "assistant" | "system" | "user";
}

export const validateEventPayload = <T extends ChatEventType>(
  eventType: T,
  payload: unknown,
): ChatEventPayload<T> => {
  const schema = EVENT_PAYLOAD_SCHEMAS[eventType];

  return schema.parse(payload) as ChatEventPayload<T>;
};
