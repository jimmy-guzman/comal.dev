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
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import type { Database } from "@/db/service";
import type { DatabaseError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

import { loadAgent } from "@/agents";
import { appRuntime } from "@/db/service";
import { Auth, AuthLive } from "@/lib/auth-context";
import { updateConversationTitle } from "@/lib/chat";
import { classifyChatError } from "@/lib/chat/errors";
import { appendChatEvent, persistChatStream } from "@/lib/chat/persist-stream";
import { countAssistantTurns, getConversationWithEvents } from "@/lib/chat/store";
import { LLMError, MessageConversionError, ValidationError } from "@/lib/errors";
import { openrouter } from "@/lib/openrouter";

const postBodySchema = z.object({
  conversationId: z.string().min(1),
  messages: z.array(z.unknown()).min(1),
  timezone: z
    .string()
    .trim()
    .max(64)
    .regex(/^(?:UTC|GMT|[A-Za-z_]+(?:\/[\w+-]+)+)$/, "Invalid IANA timezone")
    .refine(
      (tz) => {
        try {
          return Intl.supportedValuesOf("timeZone").includes(tz);
        } catch {
          return false;
        }
      },
      { message: "Unsupported timezone" },
    )
    .optional()
    // eslint-disable-next-line unicorn/prefer-top-level-await -- Zod's .catch(), not a Promise.catch()
    .catch(undefined),
});

const logError = (message: string, error: unknown): void => {
  // eslint-disable-next-line no-console -- fire-and-forget logging from non-Effect callbacks
  console.error(message, error);
};

const errorToResponse = (
  error:
    | DatabaseError
    | ForbiddenError
    | MessageConversionError
    | NotFoundError
    | UnauthorizedError
    | ValidationError,
): Response => {
  if (error._tag === "ValidationError") {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error._tag === "MessageConversionError") {
    return Response.json({ error: "Failed to convert messages." }, { status: 400 });
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

interface ApprovalResponseEvent {
  approval: { approved: boolean; id: string; reason?: string };
  messageId: string;
  toolCallId: string;
  toolName: string;
}

const extractApprovalResponses = (messages: UIMessage[]): ApprovalResponseEvent[] => {
  return messages.flatMap((msg) => {
    if (msg.role !== "assistant") return [];

    return msg.parts.flatMap((part): ApprovalResponseEvent[] => {
      if (!isToolUIPart(part)) return [];

      if (part.state !== "approval-responded") return [];

      if (typeof part.approval.approved !== "boolean") return [];

      return [
        {
          approval: {
            approved: part.approval.approved,
            id: part.approval.id,
            reason: part.approval.reason,
          },
          messageId: msg.id,
          toolCallId: part.toolCallId,
          toolName: part.type === "dynamic-tool" ? part.toolName : part.type.replace(/^tool-/, ""),
        },
      ];
    });
  });
};

const stringifyText = (parts: UIMessage["parts"]): string => {
  return parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(" ");
};

const generateTitleEffect = (
  conversationId: string,
  modelId: string,
  userText: string,
): Effect.Effect<void, DatabaseError | LLMError, Database> => {
  return Effect.gen(function* () {
    const { text: title } = yield* Effect.tryPromise({
      catch: (cause) => new LLMError({ cause }),
      try: () => {
        return generateText({
          model: openrouter(modelId),
          prompt: `Summarize the following user message in 4 to 6 words. Return only the title, no punctuation, no quotes.\n\nUser: ${userText}`,
        });
      },
    });

    yield* updateConversationTitle(conversationId, title.trim());

    revalidatePath("/", "layout");
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

  const { conversationId, timezone } = parsed.data;

  const requestHeaders = await headers();

  type ChatError =
    | DatabaseError
    | ForbiddenError
    | MessageConversionError
    | NotFoundError
    | UnauthorizedError
    | ValidationError;

  const program = Effect.gen(function* () {
    const { user } = yield* Auth;

    const conv = yield* getConversationWithEvents(user.id, conversationId);

    const agent = yield* loadAgent(conv.agentId, user.id);

    const persistedUserMessageIds = new Set<string>();

    for (const event of conv.events) {
      if (event.eventType === "user-message" && event.messageId !== null) {
        persistedUserMessageIds.add(event.messageId);
      }
    }

    const persistedApprovalToolCallIds = new Set<string>();

    for (const event of conv.events) {
      if (event.eventType !== "tool-approval-responded") continue;

      if (typeof event.payload !== "object" || event.payload === null) continue;

      const { toolCallId } = event.payload as { toolCallId?: unknown };

      if (typeof toolCallId === "string") {
        persistedApprovalToolCallIds.add(toolCallId);
      }
    }

    const incomingMessages = parsed.data.messages.filter((msg) => {
      if (typeof msg !== "object" || msg === null) return true;

      const { parts } = msg as { parts?: unknown };

      return !Array.isArray(parts) || parts.length > 0;
    });

    const validation = yield* Effect.tryPromise({
      catch: (cause) => {
        return new ValidationError({ cause, message: "Failed to validate messages." });
      },
      try: () => safeValidateUIMessages({ messages: incomingMessages }),
    });

    if (!validation.success) {
      return yield* Effect.fail(new ValidationError({ message: validation.error.message }));
    }

    const userMessage = validation.data.toReversed().find((m) => {
      return m.role === "user";
    });

    const isFirstTurn = (yield* countAssistantTurns(conversationId)) === 0;

    if (userMessage && !persistedUserMessageIds.has(userMessage.id)) {
      yield* appendChatEvent({
        conversationId,
        event: {
          eventType: "user-message",
          messageId: userMessage.id,
          payload: { parts: userMessage.parts },
          role: "user",
        },
        modelId: conv.modelId,
      });
    }

    const approvalResponses = extractApprovalResponses(validation.data).filter((approval) => {
      return !persistedApprovalToolCallIds.has(approval.toolCallId);
    });

    for (const approval of approvalResponses) {
      yield* appendChatEvent({
        conversationId,
        event: {
          eventType: "tool-approval-responded",
          messageId: approval.messageId,
          payload: {
            approval: approval.approval,
            approved: approval.approval.approved,
            toolCallId: approval.toolCallId,
            toolName: approval.toolName,
          },
          role: "assistant",
        },
        modelId: conv.modelId,
      });
    }

    const modelMessages = yield* Effect.tryPromise({
      catch: (cause) => new MessageConversionError({ cause }),
      try: () => {
        return convertToModelMessages(validation.data, { ignoreIncompleteToolCalls: true });
      },
    });

    const systemPrompt = timezone
      ? `${agent.systemPrompt}\n\nThe user's local timezone is ${timezone}.`
      : agent.systemPrompt;

    const lastMessage = validation.data.at(-1);
    const assistantMessageId = lastMessage?.role === "assistant" ? lastMessage.id : nanoid();

    const result = streamText({
      messages: modelMessages,
      model: openrouter(conv.modelId),
      onError: ({ error }) => {
        logError("streamText error", error);
      },
      stopWhen: stepCountIs(8),
      system: systemPrompt,
      tools: agent.tools,
    });

    after(async () => {
      try {
        await persistChatStream({
          conversationId,
          fullStream: result.fullStream,
          messageId: assistantMessageId,
          modelId: conv.modelId,
          onEventError: (error, event) => {
            logError(`persistChatStream event error (${event.eventType})`, error);
          },
        });

        if (isFirstTurn && userMessage) {
          const userText = stringifyText(userMessage.parts).slice(0, 500);

          await appRuntime.runPromise(
            generateTitleEffect(conversationId, conv.modelId, userText).pipe(
              Effect.tapError((error) => {
                return Effect.logError("Title generation failed", error);
              }),
              Effect.catchAll(() => Effect.void),
              Effect.provide(Logger.pretty),
            ),
          );
        }
      } catch (error) {
        logError("after() persistence failed", error);
      }
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        logError("UI message stream error", error);

        const info = classifyChatError(error);

        return JSON.stringify({
          kind: info.kind,
          message: info.message,
          retryable: info.retryable,
          statusCode: info.statusCode,
          suggestModelSwitch: info.suggestModelSwitch,
        });
      },
      originalMessages: validation.data,
    });
  }) satisfies Effect.Effect<Response, ChatError, Auth | Database>;

  return await appRuntime.runPromise(
    program.pipe(
      Effect.tapError((error) => Effect.logError("Chat error", error)),
      Effect.tapDefect((defect) => Effect.logError("Unexpected defect", defect)),
      Effect.catchAll((error) => Effect.succeed(errorToResponse(error))),
      Effect.provide(AuthLive(requestHeaders)),
      Effect.provide(Logger.pretty),
    ),
  );
}
