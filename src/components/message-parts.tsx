"use client";

import type { UIMessage } from "ai";

import { isToolUIPart } from "ai";

import type {ErrorPartData} from "@/components/error-part";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { ErrorPart  } from "@/components/error-part";
import { TextPart } from "@/components/text-part";
import { ToolPart } from "@/components/tool-part";

interface MessagePartsProps {
  addToolApprovalResponse: (response: {
    approved: boolean;
    id: string;
  }) => void;
  canRetry: boolean;
  isLastMessage: boolean;
  isStreaming: boolean;
  message: UIMessage;
  onRetry?: () => void;
}

const isErrorDataPart = (part: UIMessage["parts"][number]): part is UIMessage["parts"][number] & {
  data: ErrorPartData;
  type: "data-error";
} => part.type === "data-error";

export const MessageParts = ({
  addToolApprovalResponse,
  canRetry,
  isLastMessage,
  isStreaming,
  message,
  onRetry,
}: MessagePartsProps) => {
  const reasoningParts = message.parts.filter((part) => {
    return part.type === "reasoning";
  });
  const reasoningText = reasoningParts.map((part) => part.text).join("\n\n");
  const hasReasoning = reasoningParts.length > 0;

  const lastPart = message.parts.at(-1);
  const isReasoningStreaming =
    isLastMessage && isStreaming && lastPart?.type === "reasoning";

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
    </>
  );
};
