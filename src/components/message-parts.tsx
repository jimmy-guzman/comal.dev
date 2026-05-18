"use client";

import type { ChatStatus, UIMessage } from "ai";

import { isToolUIPart } from "ai";
import { BrainIcon } from "lucide-react";

import type { ErrorPartData } from "@/components/error-part";
import type { SubagentTraces } from "@/lib/chat/projector";

import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ErrorPart } from "@/components/error-part";
import { TextPart } from "@/components/text-part";
import { ToolPart } from "@/components/tool-part";

interface MessagePartsProps {
  addToolApprovalResponse: (response: { approved: boolean; id: string }) => void;
  canRetry: boolean;
  isLastMessage: boolean;
  message: UIMessage;
  onRetry?: () => void;
  status: ChatStatus;
  subagentTraces?: SubagentTraces;
}

const isErrorDataPart = (
  part: UIMessage["parts"][number],
): part is UIMessage["parts"][number] & {
  data: ErrorPartData;
  type: "data-error";
} => part.type === "data-error";

const hasRunningStatus = (value: unknown): value is { status: "running" } => {
  return (
    typeof value === "object" && value !== null && "status" in value && value.status === "running"
  );
};

const hasVisibleActiveTool = (part: UIMessage["parts"][number]) => {
  if (!isToolUIPart(part)) return false;

  if (
    part.state === "approval-requested" ||
    part.state === "input-available" ||
    part.state === "input-streaming"
  ) {
    return true;
  }

  return hasRunningStatus(part.output);
};

export const MessageParts = ({
  addToolApprovalResponse,
  canRetry,
  isLastMessage,
  message,
  onRetry,
  status,
  subagentTraces,
}: MessagePartsProps) => {
  const isStreaming = status === "streaming";
  const isLoading = status === "submitted" || isStreaming;

  const reasoningParts = message.parts.filter((part) => {
    return part.type === "reasoning";
  });
  const reasoningText = reasoningParts.map((part) => part.text).join("\n\n");
  const hasReasoning = reasoningParts.length > 0;

  const lastPart = message.parts.at(-1);
  const isReasoningStreaming = isLastMessage && isStreaming && lastPart?.type === "reasoning";
  const hasStreamingText = message.parts.some((part) => {
    return part.type === "text" && part.state === "streaming";
  });
  const hasVisibleThinkingSignal = message.parts.some(hasVisibleActiveTool);
  const shouldShowThinkingCue =
    message.role === "assistant" &&
    isLastMessage &&
    isLoading &&
    !hasStreamingText &&
    !isReasoningStreaming &&
    !hasVisibleThinkingSignal;

  return (
    <>
      {hasReasoning && (
        <Reasoning className="w-full" isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          // eslint-disable-next-line react-x/no-array-index-key -- index is okay here
          return <TextPart key={`${message.id}-text-${index}`} part={part} />;
        }

        if (isToolUIPart(part)) {
          return (
            <ToolPart
              addToolApprovalResponse={addToolApprovalResponse}
              key={part.toolCallId}
              part={part}
              subagentTraces={subagentTraces}
            />
          );
        }

        if (isErrorDataPart(part)) {
          return (
            <ErrorPart
              canRetry={canRetry && isLastMessage}
              data={part.data}
              key={part.id ?? `${message.id}-error-${index.toString()}`}
              onRetry={onRetry}
            />
          );
        }

        return null;
      })}
      {shouldShowThinkingCue ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <BrainIcon className="size-4" />
          <Shimmer duration={1}>Thinking...</Shimmer>
        </div>
      ) : null}
    </>
  );
};
