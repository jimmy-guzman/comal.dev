import type { Tool, UIMessage } from "ai";

import { readUIMessageStream, stepCountIs, tool, ToolLoopAgent } from "ai";
import { nanoid } from "nanoid";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { openrouter } from "@/lib/openrouter";

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
}

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
}: BuildSubagentToolArgs): Tool => {
  return tool({
    description: buildDescription({
      childDescription,
      childName,
      override: link.descriptionOverride,
    }),
    async *execute({ prompt }, { abortSignal }) {
      const runId = nanoid();

      const child = await appRuntime.runPromise(loadAgent(link.childAgentId, ownerId, 1));

      const agent = new ToolLoopAgent({
        instructions: child.systemPrompt,
        model: openrouter(child.defaultModelId),
        stopWhen: stepCountIs(8),
        tools: child.tools,
      });

      const result = await agent.stream({
        abortSignal,
        prompt,
      });

      let lastMessages: UIMessage[] = [];

      for await (const message of readUIMessageStream({
        stream: result.toUIMessageStream(),
      })) {
        lastMessages = [message];

        yield {
          messages: lastMessages,
          runId,
          status: "running" as const,
        };
      }

      return {
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
