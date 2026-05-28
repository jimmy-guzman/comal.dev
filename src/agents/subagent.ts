import type { Tool, UIMessage } from "ai";

import { readUIMessageStream, stepCountIs, tool, ToolLoopAgent } from "ai";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { z } from "zod";

import type { ChatStreamContext } from "@/lib/chat/stream-context";

import { appRuntime } from "@/db/runtime";
import { persistChatStream } from "@/lib/chat/persist-stream";
import { openrouterForUser } from "@/lib/openrouter";

import { loadAgent } from "./index";

interface SubagentLink {
  alias: string;
  childAgentId: string;
  descriptionOverride: null | string;
}

interface BuildSubagentToolArgs {
  childDescription: string;
  childName: string;
  link: SubagentLink;
  ownerId: string;
  parentDepth: number;
  sandbox: boolean;
}

const subagentStepCap = (childDepth: number) => {
  if (childDepth >= 2) return stepCountIs(2);

  return stepCountIs(4);
};

const outputSchema = z.object({
  runId: z.string(),
  status: z.enum(["running", "done"]),
  text: z.string().optional(),
});

const inputSchema = z.object({
  prompt: z.string().min(1).describe("The instruction for the sub-agent to carry out."),
});

const buildDescription = (args: {
  childDescription: string;
  childName: string;
  override: null | string;
}) => {
  if (args.override && args.override.trim().length > 0) {
    return args.override.trim();
  }

  const base = args.childDescription.trim();
  const fallback = `Delegate a task to the "${args.childName}" sub-agent.`;

  return base.length > 0 ? base : fallback;
};

const lastAssistantText = (messages: UIMessage[]) => {
  const reversed = messages.toReversed();

  for (const message of reversed) {
    if (message.role !== "assistant") continue;

    const text = message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("");

    if (text.trim().length > 0) return text;
  }

  return "";
};

export const buildSubagentTool = ({
  childDescription,
  childName,
  link,
  ownerId,
  parentDepth,
  sandbox,
}: BuildSubagentToolArgs): Tool => {
  const childDepth = parentDepth + 1;

  return tool({
    description: buildDescription({
      childDescription,
      childName,
      override: link.descriptionOverride,
    }),
    async *execute({ prompt }, { abortSignal, experimental_context, toolCallId }) {
      const runId = nanoid();
      const streamCtx = experimental_context as ChatStreamContext | undefined;

      const child = await appRuntime.runPromise(
        loadAgent(link.childAgentId, ownerId, { depth: childDepth, sandbox }),
      );

      const openrouter = await appRuntime.runPromise(openrouterForUser(ownerId));

      const agent = new ToolLoopAgent({
        instructions: child.systemPrompt,
        model: openrouter(child.defaultModelId),
        stopWhen: subagentStepCap(childDepth),
        tools: child.tools,
      });

      const result = await agent.stream({
        abortSignal,
        prompt,
      });

      const childMessageId = nanoid();

      const persistPromise = streamCtx
        ? persistChatStream({
            conversationId: streamCtx.conversationId,
            fullStream: result.fullStream,
            messageId: childMessageId,
            modelId: child.defaultModelId,
            onEventError: (error) => {
              void appRuntime.runPromise(
                Effect.logError("subagent persistChatStream event error", error),
              );
            },
            parentToolCallId: toolCallId,
          })
        : null;

      const messageMap = new Map<string, UIMessage>();

      for await (const message of readUIMessageStream({
        stream: result.toUIMessageStream(),
      })) {
        messageMap.set(message.id, message);

        yield {
          messages: [...messageMap.values()],
          runId,
          status: "running" as const,
        };
      }

      await persistPromise;

      const lastMessages = [...messageMap.values()];

      yield {
        runId,
        status: "done" as const,
        text: lastAssistantText(lastMessages),
      };
    },
    inputSchema,
    toModelOutput: ({ output }) => {
      const parsed = outputSchema.safeParse(output);
      const text = parsed.success && parsed.data.status === "done" ? (parsed.data.text ?? "") : "";

      return { type: "content", value: [{ text, type: "text" }] };
    },
  });
};
