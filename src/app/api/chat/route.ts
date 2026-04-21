import { modelMessageSchema, streamText } from "ai";
import { z } from "zod";

import { openrouter } from "@/lib/openrouter";

const defaultModelId = "openai/gpt-4o-mini";

const postBodySchema = z.object({
  messages: z.array(modelMessageSchema).min(1),
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

  const result = streamText({
    model: openrouter(defaultModelId),
    messages: parsed.data.messages,
  });

  return result.toTextStreamResponse();
}
