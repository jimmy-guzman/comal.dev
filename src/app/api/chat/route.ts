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
import { Effect, Exit } from "effect";
import { z } from "zod";

import { getAgent } from "@/agents";
import { DatabaseLive } from "@/db/service";
import { auth } from "@/lib/auth";
import {
  assertConversationAccess,
  getConversationAgent,
  getConversationMessageCount,
  insertChatMessage,
  updateConversationTitle,
} from "@/lib/chat";
import {
  DatabaseError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { openrouter } from "@/lib/openrouter";

const postBodySchema = z.object({
  messages: z.array(z.unknown()).min(1),
  conversationId: z.string().min(1),
});

const errorToResponse = (
  error: ValidationError | UnauthorizedError | ForbiddenError | NotFoundError | DatabaseError,
): Response => {
  if (error._tag === "ValidationError") {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error._tag === "UnauthorizedError") {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (error._tag === "ForbiddenError") {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  if (error._tag === "NotFoundError") {
    return Response.json({ error: `${error.resource} not found.` }, { status: 404 });
  }
  return Response.json({ error: "Internal server error." }, { status: 500 });
};

const persistAfterStream = (
  responseMessage: UIMessage,
  userMessage: UIMessage | undefined,
  conversationId: string,
  modelId: string,
): Effect.Effect<void, DatabaseError, never> =>
  Effect.gen(function* () {
    const responseMessageId = responseMessage.id?.trim();

    yield* Effect.provide(
      insertChatMessage({
        id: responseMessageId && responseMessageId.length > 0 ? responseMessageId : undefined,
        conversationId,
        role: responseMessage.role,
        parts: responseMessage.parts,
        modelId,
      }),
      DatabaseLive,
    );

    const messageCount = yield* Effect.provide(
      getConversationMessageCount(conversationId),
      DatabaseLive,
    );

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

      const { text: title } = yield* Effect.tryPromise({
        try: () =>
          generateText({
            model: openrouter(modelId),
            prompt: `Summarize the following conversation exchange in 4 to 6 words. Return only the title, no punctuation, no quotes.\n\nUser: ${userText}\n\nAssistant: ${assistantText}`,
          }),
        catch: (cause) => new DatabaseError({ cause }),
      });

      yield* Effect.provide(
        updateConversationTitle(conversationId, title.trim()),
        DatabaseLive,
      );

      revalidatePath("/", "layout");
    }
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

  const { conversationId } = parsed.data;

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { user } = session;

  type ChatError = ValidationError | ForbiddenError | NotFoundError | DatabaseError;

  const program = Effect.gen(function* () {
    yield* Effect.provide(
      assertConversationAccess(user.id, conversationId),
      DatabaseLive,
    );

    const conv = yield* Effect.provide(
      getConversationAgent(conversationId),
      DatabaseLive,
    );

    const agent = getAgent(conv.agentId);

    if (!agent) {
      return yield* Effect.fail(new NotFoundError({ resource: "agent" }));
    }

    const validation = yield* Effect.tryPromise({
      try: () => safeValidateUIMessages({ messages: parsed.data.messages }),
      catch: (cause) => new DatabaseError({ cause }),
    });

    if (!validation.success) {
      return yield* Effect.fail(new ValidationError({ message: validation.error.message }));
    }

    const userMessage = [...validation.data].reverse().find((m) => m.role === "user");

    if (userMessage) {
      yield* Effect.provide(
        insertChatMessage({
          id: userMessage.id,
          conversationId,
          role: userMessage.role,
          parts: userMessage.parts,
          modelId: conv.modelId,
        }),
        DatabaseLive,
      );
    }

    const messagesWithoutIds = validation.data.map((msg) =>
      Object.fromEntries(Object.entries(msg).filter(([k]) => k !== "id")),
    ) as Omit<(typeof validation.data)[number], "id">[];

    const modelMessages = yield* Effect.tryPromise({
      try: () => convertToModelMessages(messagesWithoutIds),
      catch: (cause) => new DatabaseError({ cause }),
    });

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
      const exit = await Effect.runPromiseExit(
        persistAfterStream(
          await finishPromise,
          userMessage,
          conversationId,
          conv.modelId,
        ),
      );

      if (Exit.isFailure(exit)) {
        console.error("[chat/route] failed to persist assistant message:", exit.cause);
      }
    });

    return result.toUIMessageStreamResponse({
      onFinish: ({ responseMessage }) => {
        resolveFinish(responseMessage);
      },
    });
  }) satisfies Effect.Effect<Response, ChatError, never>;

  const exit = await Effect.runPromiseExit(program);

  return Exit.match(exit, {
    onSuccess: (response) => response,
    onFailure: (cause) => {
      const error = cause._tag === "Fail" ? cause.error : new DatabaseError({ cause });
      return errorToResponse(error as ChatError);
    },
  });
}
