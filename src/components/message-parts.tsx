"use client";

import type { UIMessage } from "ai";

import { isToolUIPart } from "ai";
import * as React from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { ToolPart } from "@/components/tool-part";

interface MessagePartsProps {
  addToolApprovalResponse: (response: { approved: boolean; id: string }) => void;
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
  const isReasoningStreaming = isLastMessage && isStreaming && lastPart?.type === "reasoning";

  return (
    <>
      {hasReasoning && (
        <Reasoning className="w-full" isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}
      {message.parts
        .reduce<{ key: string; node: React.ReactNode }[]>((acc, part) => {
          if (part.type === "text") {
            const textCount = acc.filter((x) => {
              return x.key.startsWith(`${message.id}-text`);
            }).length;

            acc.push({
              key: `${message.id}-text-${textCount}`,
              node: (
                <MessageResponse isAnimating={part.state === "streaming"}>
                  {part.text}
                </MessageResponse>
              ),
            });
          } else if (isToolUIPart(part)) {
            acc.push({
              key: part.toolCallId,
              node: <ToolPart addToolApprovalResponse={addToolApprovalResponse} part={part} />,
            });
          }

          return acc;
        }, [])
        .map(({ key, node }) => {
          return <React.Fragment key={key}>{node}</React.Fragment>;
        })}
    </>
  );
};
