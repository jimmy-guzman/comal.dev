"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";
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

type UpdateSpecOutput = { ok?: boolean; revisionNumber?: number; error?: string };

function renderAssistantPart(
  part: UIMessage["parts"][number],
  key: string,
  isStreamingMessage: boolean,
  partIndex: number,
  messagePartsLength: number,
) {
  const isLastPart = partIndex === messagePartsLength - 1;
  const partIsStreaming = isStreamingMessage && isLastPart;

  switch (part.type) {
    case "reasoning": {
      return (
        <Reasoning className="w-full" isStreaming={partIsStreaming} key={key}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    }
    case "text": {
      return (
        <MessageResponse isAnimating={partIsStreaming} key={key}>
          {part.text}
        </MessageResponse>
      );
    }
    case "step-start": {
      return null;
    }
    default: {
      if (!isToolUIPart(part)) {
        return null;
      }
      if (part.type === "tool-updateWorkspaceSpec") {
        switch (part.state) {
          case "input-streaming":
          case "input-available": {
            return (
              <p className="text-muted-foreground text-xs" key={key}>
                Updating spec…
              </p>
            );
          }
          case "output-available": {
            const out = part.output as UpdateSpecOutput;
            if (out.ok) {
              return (
                <p className="text-muted-foreground text-xs" key={key}>
                  Spec updated (revision {out.revisionNumber}).
                </p>
              );
            }
            return (
              <p className="text-destructive text-xs" key={key}>
                {out.error ?? "Could not update the spec."}
              </p>
            );
          }
          case "output-error": {
            return (
              <p className="text-destructive text-xs" key={key}>
                {part.errorText}
              </p>
            );
          }
          default: {
            return null;
          }
        }
      }
      return (
        <p className="text-muted-foreground text-xs" key={key}>
          {part.type.replace(/^tool-/, "")}
        </p>
      );
    }
  }
}

type StudioChatProps = {
  workspaceId: string;
  initialMessages?: UIMessage[];
};

export function StudioChat({ workspaceId, initialMessages = [] }: StudioChatProps) {
  const router = useRouter();
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
    onFinish: ({ message, isError, isAbort }) => {
      if (isError || isAbort || message.role !== "assistant") {
        return;
      }
      const specWasUpdated = message.parts.some(
        (part) =>
          isToolUIPart(part) &&
          part.type === "tool-updateWorkspaceSpec" &&
          part.state === "output-available" &&
          (part.output as UpdateSpecOutput).ok === true,
      );
      if (specWasUpdated) {
        startTransition(() => {
          router.refresh();
        });
      }
    },
  });

  const handleSubmit = useCallback(
    ({ text }: PromptInputMessage) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      void sendMessage({ text: trimmed }, { body: { model: modelId, workspaceId } });
    },
    [sendMessage, modelId, workspaceId],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <Conversation className="h-full min-h-0">
          <ConversationContent>
            {messages.map((message, messageIndex) => {
              const isLastMessage = messageIndex === messages.length - 1;
              const isStreamingMessage = isLastMessage && status === "streaming";

              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.role === "assistant"
                      ? message.parts.map((part, partIndex) =>
                          renderAssistantPart(
                            part,
                            `${message.id}-${partIndex}`,
                            isStreamingMessage,
                            partIndex,
                            message.parts.length,
                          ),
                        )
                      : message.parts.map((part, partIndex) =>
                          part.type === "text" ? (
                            <div className="whitespace-pre-wrap" key={`${message.id}-${partIndex}`}>
                              {part.text}
                            </div>
                          ) : null,
                        )}
                  </MessageContent>
                </Message>
              );
            })}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

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
          <PromptInputSubmit onStop={stop} status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
