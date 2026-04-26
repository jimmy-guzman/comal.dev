"use client";

import type { UIMessage } from "ai";

import { isToolUIPart } from "ai";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { TextPart } from "@/components/text-part";
import { ToolPart } from "@/components/tool-part";

interface MessagePartsProps {
  addToolApprovalResponse: (response: {
    approved: boolean;
    id: string;
  }) => void;
  isLastMessage: boolean;
  isStreaming: boolean;
  message: UIMessage;
}

export const MessageParts = ({
  addToolApprovalResponse,
  isLastMessage,
  isStreaming,
  message,
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

        return null;
      })}
    </>
  );
};
