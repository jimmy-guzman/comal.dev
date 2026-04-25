"use client";

import { useChat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

import { updateConversationModelAction } from "@/actions/update-conversation-model";
import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
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
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

const MODELS = [
  {
    provider: "openai" as const,
    label: "OpenAI",
    models: [
      { id: "openai/gpt-4o", name: "GPT-4o" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o mini" },
      { id: "openai/o3-mini", name: "o3 mini" },
    ],
  },
  {
    provider: "anthropic" as const,
    label: "Anthropic",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku" },
      { id: "anthropic/claude-3-7-sonnet", name: "Claude 3.7 Sonnet" },
    ],
  },
  {
    provider: "google" as const,
    label: "Google",
    models: [
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
      { id: "google/gemini-2.5-pro-preview-03-25", name: "Gemini 2.5 Pro" },
    ],
  },
  {
    provider: "deepseek" as const,
    label: "DeepSeek",
    models: [
      { id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
    ],
  },
] satisfies Array<{
  provider: string;
  label: string;
  models: Array<{ id: string; name: string }>;
}>;

const getModelName = (modelId: string) => {
  for (const group of MODELS) {
    const found = group.models.find((m) => m.id === modelId);
    if (found) return found.name;
  }
  return modelId;
};

const STARTER_SUGGESTIONS = [
  "What can you help me with?",
  "Search the web for the latest AI news",
  "Explain how you work",
];

interface Props {
  conversationId: string;
  initialMessages: UIMessage[];
  modelId: string;
  agentId: string;
}

const MessageParts = ({ message }: { message: UIMessage }) =>
  message.parts.map((part, i) => {
    if (part.type === "text") {
      return (
        <MessageResponse key={i} isAnimating={part.state === "streaming"}>
          {part.text}
        </MessageResponse>
      );
    }

    if (part.type === "reasoning") {
      return (
        <Reasoning key={i} isStreaming={part.state === "streaming"}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    }

    if (part.type === "dynamic-tool") {
      return (
        <Tool key={i}>
          <ToolHeader type={part.type} state={part.state} toolName={part.toolName} />
          <ToolContent>
            <ToolInput input={part.input} />
            <ToolOutput output={part.output} errorText={part.errorText} />
          </ToolContent>
        </Tool>
      );
    }

    return null;
  });

export const ChatView = ({ conversationId, initialMessages, modelId: initialModelId }: Props) => {
  const [modelId, setModelId] = useState(initialModelId);

  const { messages, status, sendMessage, stop } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { conversationId },
    }),
  });

  const handleSubmit = ({ text }: { text: string; files?: FileUIPart[] }) => {
    void sendMessage({ text });
  };

  const handleSuggestion = (suggestion: string) => {
    void sendMessage({ text: suggestion });
  };

  const handleModelSelect = (newModelId: string) => {
    setModelId(newModelId);
    void updateConversationModelAction({ conversationId, modelId: newModelId });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger />
        <div className="ml-auto">
          <ModelSelector>
            <ModelSelectorTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                {getModelName(modelId)}
              </Button>
            </ModelSelectorTrigger>
            <ModelSelectorContent>
              <ModelSelectorInput placeholder="Search models..." />
              <ModelSelectorList>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                {MODELS.map((group) => (
                  <ModelSelectorGroup key={group.provider} heading={group.label}>
                    {group.models.map((model) => (
                      <ModelSelectorItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => handleModelSelect(model.id)}
                      >
                        <ModelSelectorLogo provider={group.provider} />
                        <ModelSelectorName>{model.name}</ModelSelectorName>
                      </ModelSelectorItem>
                    ))}
                  </ModelSelectorGroup>
                ))}
              </ModelSelectorList>
            </ModelSelectorContent>
          </ModelSelector>
        </div>
      </header>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Ask anything or pick a suggestion below."
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  <MessageParts message={message} />
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationDownload messages={messages} filename={`conversation-${conversationId}.md`} />
        <ConversationScrollButton />
      </Conversation>

      <div className="flex flex-col gap-2 border-t p-4">
        {messages.length === 0 ? (
          <Suggestions>
            {STARTER_SUGGESTIONS.map((s) => (
              <Suggestion key={s} suggestion={s} onClick={handleSuggestion} />
            ))}
          </Suggestions>
        ) : null}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea placeholder="Message..." />
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInput>
      </div>
    </div>
  );
};
