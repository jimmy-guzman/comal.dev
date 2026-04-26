"use client";

import type { FileUIPart, UIMessage } from "ai";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { Trash2Icon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type {ChatErrorInfo, ChatErrorKind} from "@/lib/chat/errors";

import { updateConversationModelAction } from "@/actions/update-conversation-model";
import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
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
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { DeleteConversationButton } from "@/components/delete-conversation-button";
import { MessageParts } from "@/components/message-parts";
import { Button } from "@/components/ui/button";
import {  chatErrorCopyFor, classifyChatError } from "@/lib/chat/errors";

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

interface ServerErrorEnvelope {
  kind?: string;
  message?: string;
  retryable?: boolean;
  statusCode?: number;
  suggestModelSwitch?: boolean;
}

const parseServerError = (raw: string): null | ServerErrorEnvelope => {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (parsed === null || typeof parsed !== "object") return null;

    const envelope = parsed as Record<string, unknown>;
    const result: ServerErrorEnvelope = {};

    if (typeof envelope.kind === "string") result.kind = envelope.kind;

    if (typeof envelope.message === "string") result.message = envelope.message;

    if (typeof envelope.statusCode === "number") result.statusCode = envelope.statusCode;

    if (typeof envelope.retryable === "boolean") result.retryable = envelope.retryable;

    if (typeof envelope.suggestModelSwitch === "boolean") {
      result.suggestModelSwitch = envelope.suggestModelSwitch;
    }

    return result;
  } catch {
    return null;
  }
};

const KNOWN_KINDS = new Set<ChatErrorKind>([
  "auth",
  "context-length",
  "model-unavailable",
  "network",
  "rate-limit",
  "unknown",
]);

const isChatErrorKind = (value: unknown): value is ChatErrorKind => {
  return typeof value === "string" && KNOWN_KINDS.has(value as ChatErrorKind);
};

const errorToInfo = (error: Error): ChatErrorInfo => {
  const envelope = parseServerError(error.message);

  if (envelope === null) return classifyChatError(error);

  const base = isChatErrorKind(envelope.kind)
    ? chatErrorCopyFor(envelope.kind)
    : classifyChatError(error);

  return {
    ...base,
    message: envelope.message ?? base.message,
    retryable: envelope.retryable ?? base.retryable,
    statusCode: envelope.statusCode ?? base.statusCode,
    suggestModelSwitch: envelope.suggestModelSwitch ?? base.suggestModelSwitch,
  } satisfies ChatErrorInfo;
};

interface Props {
  agentId: string;
  conversationId: string;
  initialMessages: UIMessage[];
  modelId: string;
  suggestions: string[];
}

export const ChatView = ({
  agentId,
  conversationId,
  initialMessages,
  modelId: initialModelId,
  suggestions,
}: Props) => {
  const [modelId, setModelId] = useState(initialModelId);
  const userInteractedRef = useRef(false);

  const sendAutomaticallyWhen = useCallback(
    (options: { messages: UIMessage[] }) => {
      if (!userInteractedRef.current) {
        return false;
      }

      return lastAssistantMessageIsCompleteWithApprovalResponses(options);
    },
    [],
  );

  const {
    addToolApprovalResponse: addToolApprovalResponseRaw,
    messages,
    regenerate,
    sendMessage: sendMessageRaw,
    status,
    stop,
  } = useChat({
    messages: initialMessages,
    onError: (error) => {
      const info = errorToInfo(error);

      toast.error(info.title, { description: info.message });
    },
    sendAutomaticallyWhen,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }),
  });

  const sendMessage: typeof sendMessageRaw = (...args) => {
    userInteractedRef.current = true;

    return sendMessageRaw(...args);
  };

  const addToolApprovalResponse: typeof addToolApprovalResponseRaw = (...args) => {
    userInteractedRef.current = true;

    return addToolApprovalResponseRaw(...args);
  };

  const handleRetry = useCallback(() => {
    userInteractedRef.current = true;
    void regenerate();
  }, [regenerate]);

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
  const canRetry = status === "ready" || status === "error";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end border-b px-4 py-2">
        <DeleteConversationButton
          agentId={agentId}
          conversationId={conversationId}
          redirectAfter
          trigger={
            <Button
              className="text-muted-foreground hover:text-destructive"
              size="icon-sm"
              variant="ghost"
            >
              <Trash2Icon />
              <span className="sr-only">Delete conversation</span>
            </Button>
          }
        />
      </div>
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
                      canRetry={canRetry}
                      isLastMessage={index === messages.length - 1}
                      isStreaming={isStreaming}
                      message={message}
                      onRetry={handleRetry}
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
            {suggestions.map((s) => {
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
