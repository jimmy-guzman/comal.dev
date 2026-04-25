import type { UIMessage } from "ai";
import {
  convertToModelMessages,
  generateText,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
} from "ai";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { getAgent } from "@/agents";
import { auth } from "@/lib/auth";
import {
  assertConversationAccess,
  getConversationAgent,
  getConversationMessageCount,
  insertChatMessage,
  updateConversationTitle,
} from "@/lib/chat";
import { openrouter } from "@/lib/openrouter";

const postBodySchema = z.object({
  messages: z.array(z.unknown()).min(1),
  conversationId: z.string().min(1),
});

export async function POST(req: Request) {
  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const hasAccess = await assertConversationAccess(session.user.id, parsed.data.conversationId);

  if (!hasAccess) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const conv = await getConversationAgent(parsed.data.conversationId);

  if (!conv) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  const agent = getAgent(conv.agentId);

  if (!agent) {
    return Response.json({ error: "Agent not found." }, { status: 404 });
  }

  const validation = await safeValidateUIMessages({ messages: parsed.data.messages });

  if (!validation.success) {
    return Response.json({ error: validation.error.message }, { status: 400 });
  }

  const messagesWithoutIds = validation.data.map(({ id: _id, ...rest }) => rest);
  const modelMessages = await convertToModelMessages(messagesWithoutIds);

  const userMessage = [...validation.data].reverse().find((m) => m.role === "user");

  if (userMessage) {
    await insertChatMessage({
      id: userMessage.id,
      conversationId: parsed.data.conversationId,
      role: userMessage.role,
      parts: userMessage.parts,
      modelId: conv.modelId,
    });
  }

  const result = streamText({
    model: openrouter(conv.modelId),
    system: agent.systemPrompt,
    messages: modelMessages,
    tools: agent.tools,
    stopWhen: stepCountIs(8),
  });

  let resolveFinish!: (msg: UIMessage) => void;
  const finishPromise = new Promise<UIMessage>((res) => {
    resolveFinish = res;
  });

  after(async () => {
    try {
      const responseMessage = await finishPromise;
      const responseMessageId = responseMessage.id?.trim();

      await insertChatMessage({
        id: responseMessageId && responseMessageId.length > 0 ? responseMessageId : undefined,
        conversationId: parsed.data.conversationId,
        role: responseMessage.role,
        parts: responseMessage.parts,
        modelId: conv.modelId,
      });

      const messageCount = await getConversationMessageCount(parsed.data.conversationId);

      if (messageCount === 2) {
        const userText =
          userMessage?.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join(" ") ?? "";

        const assistantText = responseMessage.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join(" ")
          .slice(0, 500);

        const { text: title } = await generateText({
          model: openrouter(conv.modelId),
          prompt: `Summarize the following conversation exchange in 4 to 6 words. Return only the title, no punctuation, no quotes.\n\nUser: ${userText}\n\nAssistant: ${assistantText}`,
        });

        await updateConversationTitle(parsed.data.conversationId, title.trim());
        revalidatePath("/", "layout");
      }
    } catch (err) {
      console.error("[chat/route] failed to persist assistant message:", err);
    }
  });

  return result.toUIMessageStreamResponse({
    onFinish: ({ responseMessage }) => {
      resolveFinish(responseMessage);
    },
  });
}
