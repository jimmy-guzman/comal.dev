import type { UIMessage } from "ai";

import {
  convertToModelMessages,
  generateText,
  isToolUIPart,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
} from "ai";
import { Effect, Logger } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import type { ForbiddenError, UnauthorizedError } from "@/lib/errors";

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
import { DatabaseError, NotFoundError, ValidationError } from "@/lib/errors";
import { openrouter } from "@/lib/openrouter";

const postBodySchema = z.object({
  conversationId: z.string().min(1),
  messages: z.array(z.unknown()).min(1),
});

const logError = (message: string, error: unknown): void => {
  Effect.runSync(Effect.logError(message, error).pipe(Effect.provide(Logger.pretty)));
};

const errorToResponse = (
  error: DatabaseError | ForbiddenError | NotFoundError | UnauthorizedError | ValidationError,
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

const stripDeniedToolCalls = <T extends Omit<UIMessage, "id">>(messages: T[]): T[] => {
  return messages.flatMap((msg) => {
    if (msg.role !== "assistant") return [msg];

    const parts = msg.parts.filter((part) => {
      if (!isToolUIPart(part)) return true;

      if (part.state !== "approval-responded") return true;

      return part.approval.approved;
    });

    if (parts.length === 0) return [];

    return [{ ...msg, parts }];
  });
};

const persistAfterStream = (
  responseMessage: UIMessage,
  userMessage: UIMessage | undefined,
  conversationId: string,
  modelId: string,
): Effect.Effect<void, DatabaseError> => {
  return Effect.gen(function* () {
    const responseMessageId = responseMessage.id.trim();

    yield* Effect.provide(
      insertChatMessage({
        conversationId,
        id: responseMessageId && responseMessageId.length > 0 ? responseMessageId : undefined,
        modelId,
        parts: responseMessage.parts,
        role: responseMessage.role,
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
          .map((p) => (p as { text: string; type: "text" }).text)
          .join(" ") ?? "";

      const assistantText = responseMessage.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string; type: "text" }).text)
        .join(" ")
        .slice(0, 500);

      const { text: title } = yield* Effect.tryPromise({
        catch: (cause) => new DatabaseError({ cause }),
        try: () => {
          return generateText({
            model: openrouter(modelId),
            prompt: `Summarize the following conversation exchange in 4 to 6 words. Return only the title, no punctuation, no quotes.\n\nUser: ${userText}\n\nAssistant: ${assistantText}`,
          });
        },
      });

      yield* Effect.provide(updateConversationTitle(conversationId, title.trim()), DatabaseLive);

      revalidatePath("/", "layout");
    }
  });
};

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

  type ChatError = DatabaseError | ForbiddenError | NotFoundError | ValidationError;

  const program = Effect.gen(function* () {
    yield* Effect.provide(assertConversationAccess(user.id, conversationId), DatabaseLive);

    const conv = yield* Effect.provide(getConversationAgent(conversationId), DatabaseLive);

    const agent = getAgent(conv.agentId);

    if (!agent) {
      return yield* Effect.fail(new NotFoundError({ resource: "agent" }));
    }

    const validation = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => safeValidateUIMessages({ messages: parsed.data.messages }),
    });

    if (!validation.success) {
      return yield* Effect.fail(new ValidationError({ message: validation.error.message }));
    }

    const userMessage = validation.data.toReversed().find((m) => {
      return m.role === "user";
    });

    if (userMessage) {
      yield* Effect.provide(
        insertChatMessage({
          conversationId,
          id: userMessage.id,
          modelId: conv.modelId,
          parts: userMessage.parts,
          role: userMessage.role,
        }),
        DatabaseLive,
      );
    }

    const messagesWithoutIds = validation.data.map((msg) => {
      return Object.fromEntries(Object.entries(msg).filter(([k]) => k !== "id"));
    }) as Omit<(typeof validation.data)[number], "id">[];

    const modelMessages = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return convertToModelMessages(stripDeniedToolCalls(messagesWithoutIds), {
          ignoreIncompleteToolCalls: true,
        });
      },
    });

    const result = streamText({
      messages: modelMessages,
      model: openrouter(conv.modelId),
      onError: ({ error }) => {
        logError("streamText error", error);
      },
      stopWhen: stepCountIs(8),
      system: agent.systemPrompt,
      tools: agent.tools,
    });

    let resolveFinish!: (msg: UIMessage) => void;

    const finishPromise = new Promise<UIMessage>((res) => {
      resolveFinish = res;
    });

    after(async () => {
      const exit = await Effect.runPromiseExit(
        persistAfterStream(await finishPromise, userMessage, conversationId, conv.modelId),
      );

      void exit;
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        logError("UI message stream error", error);

        return error instanceof Error ? error.message : "An error occurred during streaming.";
      },
      onFinish: ({ responseMessage }) => {
        resolveFinish(responseMessage);
      },
      originalMessages: validation.data,
    });
  }) satisfies Effect.Effect<Response, ChatError>;

  const exit = await Effect.runPromise(
    program.pipe(
      Effect.tapError((error) => Effect.logError("Chat error", error)),
      Effect.tapDefect((defect) => Effect.logError("Unexpected defect", defect)),
      Effect.map((response) => response),
      Effect.catchAll((error) => Effect.succeed(errorToResponse(error))),
      Effect.provide(Logger.pretty),
    ),
  );

  return exit;
}
