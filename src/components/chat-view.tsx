"use client";

import type { DynamicToolUIPart, FileUIPart, ToolUIPart, UIMessage } from "ai";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import * as React from "react";
import { useState } from "react";

import { updateConversationModelAction } from "@/actions/update-conversation-model";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

const MODELS = [
  {
    label: "OpenAI",
    models: [
      { id: "openai/gpt-4o", name: "GPT-4o" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
      { id: "openai/o3-mini", name: "o3 mini" },
    ],
    provider: "openai" as const,
  },
  {
    label: "Anthropic",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku" },
      { id: "anthropic/claude-3-7-sonnet", name: "Claude 3.7 Sonnet" },
    ],
    provider: "anthropic" as const,
  },
  {
    label: "Google",
    models: [
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
      { id: "google/gemini-2.5-pro-preview-03-25", name: "Gemini 2.5 Pro" },
    ],
    provider: "google" as const,
  },
  {
    label: "DeepSeek",
    models: [
      { id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
    ],
    provider: "deepseek" as const,
  },
] satisfies {
  label: string;
  models: { id: string; name: string }[];
  provider: string;
}[];

const STARTER_SUGGESTIONS = [
  "What can you help me with?",
  "Search the web for the latest AI news",
  "Explain how you work",
];

interface Props {
  conversationId: string;
  initialMessages: UIMessage[];
  modelId: string;
}

interface ToolPartProps {
  addToolApprovalResponse: (response: { approved: boolean; id: string }) => void;
  part: DynamicToolUIPart | ToolUIPart;
}

const ToolPart = ({ addToolApprovalResponse, part }: ToolPartProps) => {
  const approvalId = part.approval?.id ?? "";
  const toolName = getToolName(part);
  const output =
    typeof part.output === "string" ? (
      <MessageResponse>{part.output}</MessageResponse>
    ) : (
      part.output
    );

  return (
    <>
      <Confirmation approval={part.approval} state={part.state}>
        <ConfirmationTitle>
          Allow <strong>{toolName}</strong>?
        </ConfirmationTitle>
        <ConfirmationRequest>
          The assistant wants to run <strong>{toolName}</strong>. Do you want to allow this?
        </ConfirmationRequest>
        <ConfirmationAccepted>Approved</ConfirmationAccepted>
        <ConfirmationRejected>Rejected</ConfirmationRejected>
        <ConfirmationActions>
          <ConfirmationAction
            onClick={() => {
              addToolApprovalResponse({ approved: false, id: approvalId });
            }}
            variant="outline"
          >
            Reject
          </ConfirmationAction>
          <ConfirmationAction
            onClick={() => {
              addToolApprovalResponse({ approved: true, id: approvalId });
            }}
          >
            Approve
          </ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
      <Tool>
        {part.type === "dynamic-tool" ? (
          <ToolHeader state={part.state} toolName={toolName} type={part.type} />
        ) : (
          <ToolHeader state={part.state} type={part.type} />
        )}
        <ToolContent>
          <ToolInput input={part.input} />
          <ToolOutput errorText={part.errorText} output={output} />
        </ToolContent>
      </Tool>
    </>
  );
};

interface MessagePartsProps {
  addToolApprovalResponse: (response: { approved: boolean; id: string }) => void;
  isLastMessage: boolean;
  isStreaming: boolean;
  message: UIMessage;
}

const MessageParts = ({
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
              node: (
                <ToolPart
                  addToolApprovalResponse={addToolApprovalResponse}
                  part={part}
                />
              ),
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

export const ChatView = ({ conversationId, initialMessages, modelId: initialModelId }: Props) => {
  const [modelId, setModelId] = useState(initialModelId);

  const { addToolApprovalResponse, messages, sendMessage, status, stop } = useChat({
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId },
    }),
  });

  const handleSubmit = ({ text }: { files?: FileUIPart[]; text: string }) => {
    void sendMessage({ text });
  };

  const handleSuggestion = (suggestion: string) => {
    void sendMessage({ text: suggestion });
  };

  const handleModelSelect = (newModelId: string) => {
    setModelId(newModelId);
    void updateConversationModelAction({ conversationId, modelId: newModelId });
  };

  const isStreaming = status === "streaming";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Ask anything or pick a suggestion below."
              title="Start a conversation"
            />
          ) : (
            messages.map((message, index) => {
              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    <MessageParts
                      addToolApprovalResponse={addToolApprovalResponse}
                      isLastMessage={index === messages.length - 1}
                      isStreaming={isStreaming}
                      message={message}
                    />
                  </MessageContent>
                </Message>
              );
            })
          )}
        </ConversationContent>
        <ConversationDownload filename={`conversation-${conversationId}.md`} messages={messages} />
        <ConversationScrollButton />
      </Conversation>

      <div className="flex flex-col gap-2 border-t p-4">
        {messages.length === 0 ? (
          <Suggestions>
            {STARTER_SUGGESTIONS.map((s) => {
              return <Suggestion key={s} onClick={handleSuggestion} suggestion={s} />;
            })}
          </Suggestions>
        ) : null}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Message..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputSelect onValueChange={handleModelSelect} value={modelId}>
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {MODELS.flatMap((group) => {
                    return group.models.map((model) => {
                      return (
                        <PromptInputSelectItem key={model.id} value={model.id}>
                          {model.name}
                        </PromptInputSelectItem>
                      );
                    });
                  })}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit onStop={stop} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};
