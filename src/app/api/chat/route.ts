import { convertToModelMessages, safeValidateUIMessages, streamText } from "ai";
import { z } from "zod";

import { openrouter } from "@/lib/openrouter";

const defaultModelId = "openai/gpt-4o-mini";

const postBodySchema = z.object({
  id: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  messageId: z.string().nullable().optional(),
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

  const modelId = parsed.data.model ?? defaultModelId;

  const result = streamText({
    model: openrouter(modelId),
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
