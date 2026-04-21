"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_OPENROUTER_MODEL,
  labelForOpenRouterModelId,
  OPENROUTER_MODELS,
  OPENROUTER_MODEL_STORAGE_KEY,
} from "@/lib/openrouter-models";

type StudioChatProps = {
  workspaceId: string;
  initialMessages?: UIMessage[];
};

export function StudioChat({ workspaceId, initialMessages = [] }: StudioChatProps) {
  const [modelId, setModelId] = useState<string>(DEFAULT_OPENROUTER_MODEL.id);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelsHydrated, setModelsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(OPENROUTER_MODEL_STORAGE_KEY);
      if (stored && OPENROUTER_MODELS.some((m) => m.id === stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of persisted model after mount
        setModelId(stored);
      }
    } catch {
      // ignore
    }
    setModelsHydrated(true);
  }, []);

  useEffect(() => {
    if (!modelsHydrated) {
      return;
    }
    try {
      localStorage.setItem(OPENROUTER_MODEL_STORAGE_KEY, modelId);
    } catch {
      // ignore
    }
  }, [modelId, modelsHydrated]);

  const { messages, sendMessage, status, stop } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = useCallback(
    async ({ text }: PromptInputMessage) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      await sendMessage(
        {
          text: trimmed,
        },
        { body: { model: modelId, workspaceId } },
      );
    },
    [sendMessage, modelId, workspaceId],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.map((message, messageIndex) => {
            const isLastMessage = messageIndex === messages.length - 1;
            const isStreamingMessage = isLastMessage && status === "streaming";

            return (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.role === "assistant"
                    ? message.parts.map((part, partIndex) => {
                        const isLastPart = partIndex === message.parts.length - 1;
                        const partIsStreaming = isStreamingMessage && isLastPart;
                        const key = `${message.id}-${partIndex}`;

                        switch (part.type) {
                          case "reasoning":
                            return (
                              <Reasoning className="w-full" isStreaming={partIsStreaming} key={key}>
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          case "text":
                            return (
                              <MessageResponse isAnimating={partIsStreaming} key={key}>
                                {part.text}
                              </MessageResponse>
                            );
                          default:
                            return null;
                        }
                      })
                    : message.parts.map((part, partIndex) =>
                        part.type === "text" ? (
                          <p className="whitespace-pre-wrap" key={`${message.id}-${partIndex}`}>
                            {part.text}
                          </p>
                        ) : null,
                      )}
                </MessageContent>
              </Message>
            );
          })}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput className="shrink-0" onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea placeholder="Describe what you want in your OpenAPI spec…" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <ModelSelector onOpenChange={setModelPickerOpen} open={modelPickerOpen}>
              <ModelSelectorTrigger asChild>
                <Button
                  className="border-border h-8 gap-1.5 px-2 font-normal"
                  type="button"
                  variant="outline"
                >
                  <ModelSelectorLogoGroup>
                    <ModelSelectorLogo provider="openrouter" />
                  </ModelSelectorLogoGroup>
                  <ModelSelectorName className="text-foreground max-w-36 text-xs">
                    {labelForOpenRouterModelId(modelId)}
                  </ModelSelectorName>
                  <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
                </Button>
              </ModelSelectorTrigger>
              <ModelSelectorContent title="Model">
                <ModelSelectorInput placeholder="Search models…" />
                <ModelSelectorList>
                  <ModelSelectorGroup heading="OpenRouter">
                    {OPENROUTER_MODELS.map((m) => (
                      <ModelSelectorItem
                        key={m.id}
                        onSelect={() => {
                          setModelId(m.id);
                          setModelPickerOpen(false);
                        }}
                        value={m.id}
                      >
                        <ModelSelectorLogo provider={m.provider} />
                        <ModelSelectorName>{m.label}</ModelSelectorName>
                      </ModelSelectorItem>
                    ))}
                  </ModelSelectorGroup>
                </ModelSelectorList>
              </ModelSelectorContent>
            </ModelSelector>
          </PromptInputTools>
          <PromptInputSubmit onStop={() => void stop()} status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
