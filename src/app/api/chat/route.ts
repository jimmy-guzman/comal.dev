import { convertToModelMessages, safeValidateUIMessages, streamText } from "ai";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { openrouter } from "@/lib/openrouter";
import { assertWorkspaceWriteAccess, insertWorkspaceChatMessage } from "@/lib/studio";

const defaultModelId = "openai/gpt-4o-mini";

const postBodySchema = z.object({
  id: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  messageId: z.string().nullable().optional(),
  workspaceId: z.string().min(1),
  model: z.string().min(1).optional(),
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

  const validation = await safeValidateUIMessages({
    messages: parsed.data.messages,
  });

  if (!validation.success) {
    return Response.json({ error: validation.error.message }, { status: 400 });
  }

  const messagesWithoutIds = validation.data.map((m) => {
    const { id, ...rest } = m;
    void id;
    return rest;
  });

  const modelMessages = await convertToModelMessages(messagesWithoutIds);

  const access = await assertWorkspaceWriteAccess(session.user.id, parsed.data.workspaceId);

  if (!access) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const userMessage = [...validation.data].reverse().find((message) => message.role === "user");

  if (userMessage) {
    await insertWorkspaceChatMessage({
      id: userMessage.id,
      workspaceId: parsed.data.workspaceId,
      role: userMessage.role,
      parts: userMessage.parts,
      createdByUserId: session.user.id,
      modelId: parsed.data.model,
    });
  }

  const modelId = parsed.data.model ?? defaultModelId;

  const result = streamText({
    model: openrouter(modelId),
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
      const responseMessageId = responseMessage.id?.trim();

      await insertWorkspaceChatMessage({
        id: responseMessageId && responseMessageId.length > 0 ? responseMessageId : undefined,
        workspaceId: parsed.data.workspaceId,
        role: responseMessage.role,
        parts: responseMessage.parts,
        createdByUserId: null,
        modelId,
      });
    },
  });
}
