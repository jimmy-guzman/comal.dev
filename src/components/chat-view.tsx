"use client";

import type { FileUIPart, UIMessage } from "ai";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { BrainIcon, ListTreeIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ModelId } from "@/config/models";
import type { ChatErrorInfo, ChatErrorKind } from "@/lib/chat/errors";
import type { SubagentTraces } from "@/lib/chat/projector";

import { updateConversationAgentAction } from "@/actions/update-conversation-agent";
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
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatAgentPicker } from "@/components/chat-agent-picker";
import { ChatModelPicker } from "@/components/chat-model-picker";
import { DeleteConversationButton } from "@/components/delete-conversation-button";
import { ErrorPart } from "@/components/error-part";
import { MessageParts } from "@/components/message-parts";
import { Button } from "@/components/ui/button";
import { useConversations } from "@/hooks/use-conversations";
import { chatErrorCopyFor, classifyChatError } from "@/lib/chat/errors";

const KNOWN_KINDS = new Set<ChatErrorKind>([
  "auth",
  "context-length",
  "model-unavailable",
  "network",
  "rate-limit",
  "unknown",
]);

interface ServerErrorEnvelope {
  kind?: string;
  message?: string;
  retryable?: boolean;
  statusCode?: number;
  suggestModelSwitch?: boolean;
}

const isChatErrorKind = (value: unknown): value is ChatErrorKind => {
  return typeof value === "string" && KNOWN_KINDS.has(value as ChatErrorKind);
};

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

const lastMessageHasErrorPart = (messages: UIMessage[]): boolean => {
  const last = messages.at(-1);

  if (last === undefined) return false;

  return last.parts.some((part) => part.type === "data-error");
};

interface Props {
  agentId: string;
  agentName: string;
  agents: { id: string; name: string }[];
  conversationId: null | string;
  initialMessages: UIMessage[];
  modelId: string;
  subagentTraces?: SubagentTraces;
  suggestions: string[];
}

export const ChatView = ({
  agentId,
  agentName,
  agents,
  conversationId: initialConversationId,
  initialMessages,
  modelId: initialModelId,
  subagentTraces,
  suggestions,
}: Props) => {
  const [conversationId, setConversationId] = useState<null | string>(initialConversationId);
  const [modelId, setModelId] = useState(initialModelId);
  const [currentAgentId, setCurrentAgentId] = useState(agentId);
  const [currentAgentName, setCurrentAgentName] = useState(agentName);
  const { prependConversation, updateConversationTitle } = useConversations();
  const userInteractedRef = useRef(false);
  const latestAgentSelectRef = useRef(agentId);
  const hiddenRef = useRef(false);

  /**
   * useChat captures the transport on first render via an internal ref, so a
   * body callback that closes over conversationId/modelId would freeze them
   * at their initial values. Without this, after the server creates a
   * conversation mid-stream the next send still posts conversationId: null
   * and forks a new conversation. Mirror the latest values into refs and
   * read them inside the body callback so each request sees current state.
   */
  const conversationIdRef = useRef(conversationId);
  const modelIdRef = useRef(modelId);
  const agentIdRef = useRef(currentAgentId);
  const agentNameRef = useRef(currentAgentName);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    modelIdRef.current = modelId;
  }, [modelId]);

  useEffect(() => {
    agentIdRef.current = currentAgentId;
  }, [currentAgentId]);

  useEffect(() => {
    agentNameRef.current = currentAgentName;
  }, [currentAgentName]);

  const sendAutomaticallyWhen = useCallback((options: { messages: UIMessage[] }) => {
    if (!userInteractedRef.current) {
      return false;
    }

    return lastAssistantMessageIsCompleteWithApprovalResponses(options);
  }, []);

  /**
   * The transport's body callback is invoked by the AI SDK at request time
   * via `resolve()` in HttpChatTransport, not during render. The
   * react-hooks/refs rule can't see across that boundary and treats the
   * `.current` reads as render-time access.
   */
  // eslint-disable-next-line react-hooks/refs -- body callback runs at request time, not during render
  const transport = new DefaultChatTransport({
    api: "/api/chat",
    body: () => {
      return {
        agentId: agentIdRef.current,
        conversationId: conversationIdRef.current,
        modelId: modelIdRef.current,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    },
  });

  const {
    addToolApprovalResponse: addToolApprovalResponseRaw,
    error,
    messages,
    regenerate,
    sendMessage: sendMessageRaw,
    setMessages,
    status,
    stop,
  } = useChat({
    messages: initialMessages,
    onData: (dataPart) => {
      if (hiddenRef.current) return;

      if (dataPart.type === "data-conversation-created") {
        const data = dataPart.data as { id?: unknown };

        if (typeof data.id !== "string") return;

        const newId = data.id;

        setConversationId(newId);
        prependConversation({
          agentId: agentIdRef.current,
          agentName: agentNameRef.current,
          id: newId,
          title: "new conversation",
        });
        // Update the URL without unmounting the current route. router.replace
        // would navigate to the sibling [conversationId] route, remounting
        // <ChatView> and aborting the in-flight stream. router.refresh() has
        // the same effect since the new URL maps to a different page component.
        globalThis.history.replaceState(null, "", `/chats/${newId}`);

        return;
      }

      if (dataPart.type === "data-conversation-title") {
        const data = dataPart.data as { id?: unknown; title?: unknown };

        if (typeof data.id !== "string" || typeof data.title !== "string") return;

        updateConversationTitle(data.id, data.title);
      }
    },
    sendAutomaticallyWhen,
    transport,
  });

  useLayoutEffect(() => {
    if (initialConversationId !== null) return undefined;

    hiddenRef.current = false;

    return () => {
      hiddenRef.current = true;
      void stop();
      setConversationId(initialConversationId);
      setModelId(initialModelId);
      setCurrentAgentId(agentId);
      setCurrentAgentName(agentName);
      setMessages([]);
      userInteractedRef.current = false;
    };
  }, [initialConversationId, initialModelId, agentId, agentName, setMessages, stop]);

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

  const handleAgentSelect = useCallback(
    (newAgentId: string) => {
      const selected = agents.find((a) => a.id === newAgentId);

      if (selected === undefined) return;

      const prevAgentId = currentAgentId;
      const prevAgentName = currentAgentName;

      latestAgentSelectRef.current = newAgentId;
      setCurrentAgentId(newAgentId);
      setCurrentAgentName(selected.name);

      if (conversationId !== null) {
        void updateConversationAgentAction({ agentId: newAgentId, conversationId }).catch(() => {
          if (latestAgentSelectRef.current !== newAgentId) return;

          setCurrentAgentId(prevAgentId);
          setCurrentAgentName(prevAgentName);
        });
      }
    },
    [agents, currentAgentId, currentAgentName, conversationId],
  );

  const handleModelSelect = (newModelId: ModelId) => {
    setModelId(newModelId);

    if (conversationId !== null) {
      void updateConversationModelAction({ conversationId, modelId: newModelId });
    }
  };

  const isStreaming = status === "streaming";
  const shouldShowTrailingThinkingCue =
    (status === "submitted" || isStreaming) && messages.at(-1)?.role !== "assistant";
  const canRetry = status === "ready" || status === "error";
  const liveErrorInfo =
    error !== undefined && !lastMessageHasErrorPart(messages) ? errorToInfo(error) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="ask anything or pick a suggestion below."
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
                      subagentTraces={subagentTraces}
                    />
                  </MessageContent>
                </Message>
              );
            })
          )}
          {liveErrorInfo === null ? null : (
            <ErrorPart canRetry={canRetry} data={liveErrorInfo} onRetry={handleRetry} />
          )}
          {shouldShowTrailingThinkingCue ? (
            <Message from="assistant">
              <MessageContent>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <BrainIcon className="size-4" />
                  <Shimmer duration={1}>Thinking...</Shimmer>
                </div>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        {conversationId === null ? null : (
          <ConversationDownload
            filename={`conversation-${conversationId}.md`}
            messages={messages}
          />
        )}
        <ConversationScrollButton />
      </Conversation>

      <div className="pb-safe-or-4 flex flex-col gap-2 border-t p-4">
        {messages.length === 0 ? (
          <Suggestions>
            {suggestions.map((s) => {
              return <Suggestion key={s} onClick={handleSuggestion} suggestion={s} />;
            })}
          </Suggestions>
        ) : null}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="message..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools className="flex-1">
              <ChatAgentPicker
                agents={agents}
                onValueChange={handleAgentSelect}
                value={currentAgentId}
              />
              <ChatModelPicker onValueChange={handleModelSelect} value={modelId} />
            </PromptInputTools>
            <div className="flex shrink-0 items-center gap-1">
              {conversationId === null ? null : (
                <>
                  <Button asChild className="hidden text-muted-foreground sm:flex" size="icon-sm" variant="ghost">
                    <Link href={`/chats/${conversationId}/trace`}>
                      <ListTreeIcon className="size-4" />
                      <span className="sr-only">view trace</span>
                    </Link>
                  </Button>
                  <DeleteConversationButton
                    conversationId={conversationId}
                    redirectAfter
                    trigger={
                      <Button
                        className="text-muted-foreground hover:text-destructive"
                        size="icon-sm"
                        variant="ghost"
                      >
                        <TrashIcon className="size-4" />
                        <span className="sr-only">delete conversation</span>
                      </Button>
                    }
                  />
                </>
              )}
              <PromptInputSubmit onStop={stop} status={status} />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};
