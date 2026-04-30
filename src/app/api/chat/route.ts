import type { UIMessage } from "ai";

import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  isToolUIPart,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
} from "ai";
import { Data, Effect, Logger } from "effect";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import type { Database } from "@/db/service";
import type { ChatEventRow } from "@/lib/chat/projector";
import type { DatabaseError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

import { loadAgent } from "@/agents";
import { appRuntime } from "@/db/service";
import { Auth, AuthLive } from "@/lib/auth-context";
import { createConversationWithFirstUserMessage, updateConversationTitle } from "@/lib/chat";
import { classifyChatError } from "@/lib/chat/errors";
import { appendChatEvent, persistChatStream } from "@/lib/chat/persist-stream";
import { countAssistantTurns, getConversationWithEvents } from "@/lib/chat/store";
import { LLMError, MessageConversionError, ValidationError } from "@/lib/errors";
import { openrouter } from "@/lib/openrouter";
import { chatLimiter, chatLimiterAnon, checkLimit, pickLimiter } from "@/lib/rate-limit";

class RateLimitError extends Data.TaggedError("RateLimitError")<{
  limit: number;
  reset: number;
}> {}

const postBodySchema = z.object({
  agentId: z.string().min(1).optional(),
  conversationId: z.string().min(1).nullable(),
  messages: z.array(z.unknown()).min(1),
  modelId: z.string().min(1).optional(),
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
    | RateLimitError
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

  if (error._tag === "RateLimitError") {
    const retryAfterSeconds = Math.max(1, Math.ceil((error.reset - Date.now()) / 1000));

    return Response.json(
      { error: "Rate limit exceeded. Please try again later." },
      { headers: { "Retry-After": String(retryAfterSeconds) }, status: 429 },
    );
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

  const {
    agentId: bodyAgentId,
    conversationId: bodyConversationId,
    modelId: bodyModelId,
    timezone,
  } = parsed.data;

  type ConversationSource =
    | { agentId: string; kind: "create"; modelId: string }
    | { conversationId: string; kind: "existing" };

  const conversationSource: ConversationSource | null =
    bodyConversationId === null
      ? bodyAgentId !== undefined && bodyModelId !== undefined
        ? { agentId: bodyAgentId, kind: "create", modelId: bodyModelId }
        : null
      : { conversationId: bodyConversationId, kind: "existing" };

  if (conversationSource === null) {
    return Response.json(
      { error: "agentId and modelId are required when creating a new conversation." },
      { status: 400 },
    );
  }

  const requestHeaders = await headers();

  type ChatError =
    | DatabaseError
    | ForbiddenError
    | MessageConversionError
    | NotFoundError
    | RateLimitError
    | UnauthorizedError
    | ValidationError;

  const program = Effect.gen(function* () {
    const { user } = yield* Auth;

    const limiter = pickLimiter({ anon: chatLimiterAnon, authed: chatLimiter }, user);

    const { limit, reset, success } = yield* Effect.promise(() => {
      return checkLimit(limiter, user.id);
    });

    if (!success) {
      return yield* Effect.fail(new RateLimitError({ limit, reset }));
    }

    const incomingMessages = parsed.data.messages.filter((msg) => {
      if (typeof msg !== "object" || msg === null) return true;

      const { parts } = msg as { parts?: unknown };

      return !Array.isArray(parts) || parts.length > 0;
    });

    // Resolve the agent (and, for existing conversations, the conversation
    // row) before message validation. Then validate, and only after
    // validation passes do we insert a new conversation row. This ordering
    // ensures a malformed request never leaves a phantom row. Neon HTTP
    // has no multi-statement transactions, so creation and the first event
    // are not strictly atomic; the validation gate is the practical
    // guarantee.
    let conversationId: string;
    let convModelId: string;
    let existingEvents: ChatEventRow[] = [];
    let isNewConversation = false;
    let resolvedAgentId: string;

    if (conversationSource.kind === "create") {
      resolvedAgentId = conversationSource.agentId;
      convModelId = conversationSource.modelId;
    } else {
      const conv = yield* getConversationWithEvents(user.id, conversationSource.conversationId);

      resolvedAgentId = conv.agentId;
      convModelId = conv.modelId;
      existingEvents = conv.events;
    }

    // loadAgent enforces ownership (filters by userId) and resolves the
    // tool implementations from the registry. Loading it before validation
    // keeps the agent-ownership gate ahead of any conversation row insert
    // for the create flow. Note: we don't pass agent.tools to
    // safeValidateUIMessages because the SDK's tools option requires a
    // compile-time-known UIMessage tools generic; our agents are dynamic
    // so we get message-shape validation here, not tool-input validation.
    // Tool inputs are still validated downstream by streamText. See
    // follow-up issue for a typed UIMessage system.
    const agent = yield* loadAgent(resolvedAgentId, user.id);

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

    if (conversationSource.kind === "create") {
      // A brand-new conversation must have a real user turn in this request.
      // Without it we have nothing to send to the model and would leave a
      // phantom row, defeating the purpose of validating before persistence.
      // Existing conversations are allowed to send approval-only payloads
      // where the last message is an assistant turn carrying responses.
      // The "real" check requires at least one part with substantive content:
      // a non-whitespace text part, or any non-text part (e.g. file upload).
      // Without this, a whitespace-only first turn would still create a row.
      const hasSubstantiveContent =
        userMessage?.parts.some((part) => {
          return part.type === "text" ? part.text.trim().length > 0 : true;
        }) ?? false;

      if (!userMessage || !hasSubstantiveContent) {
        return yield* Effect.fail(
          new ValidationError({
            message: "A new conversation requires at least one user message.",
          }),
        );
      }

      const created = yield* createConversationWithFirstUserMessage({
        agentId: conversationSource.agentId,
        modelId: conversationSource.modelId,
        title: "New conversation",
        userId: user.id,
        userMessage: { id: userMessage.id, parts: userMessage.parts },
      });

      conversationId = created.id;
      isNewConversation = true;
    } else {
      conversationId = conversationSource.conversationId;
    }

    const persistedUserMessageIds = new Set<string>();

    for (const event of existingEvents) {
      if (event.eventType === "user-message" && event.messageId !== null) {
        persistedUserMessageIds.add(event.messageId);
      }
    }

    // The first user message of a brand-new conversation was already
    // persisted atomically with the conversation row above; track it here so
    // the generic append-loop below skips it.
    if (isNewConversation && userMessage) {
      persistedUserMessageIds.add(userMessage.id);
    }

    const persistedApprovalToolCallIds = new Set<string>();

    for (const event of existingEvents) {
      if (event.eventType !== "tool-approval-responded") continue;

      if (typeof event.payload !== "object" || event.payload === null) continue;

      const { toolCallId } = event.payload as { toolCallId?: unknown };

      if (typeof toolCallId === "string") {
        persistedApprovalToolCallIds.add(toolCallId);
      }
    }

    const isFirstTurn = isNewConversation || (yield* countAssistantTurns(conversationId)) === 0;

    if (userMessage && !persistedUserMessageIds.has(userMessage.id)) {
      yield* appendChatEvent({
        conversationId,
        event: {
          eventType: "user-message",
          messageId: userMessage.id,
          payload: { parts: userMessage.parts },
          role: "user",
        },
        modelId: convModelId,
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
        modelId: convModelId,
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
      model: openrouter(convModelId),
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
          modelId: convModelId,
          onEventError: (error, event) => {
            logError(`persistChatStream event error (${event.eventType})`, error);
          },
        });

        if (isFirstTurn && userMessage) {
          const userText = stringifyText(userMessage.parts).slice(0, 500);

          await appRuntime.runPromise(
            generateTitleEffect(conversationId, convModelId, userText).pipe(
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

    const uiStream = createUIMessageStream({
      execute: ({ writer }) => {
        if (isNewConversation) {
          writer.write({
            data: { id: conversationId },
            transient: true,
            type: "data-conversation-created",
          });
        }

        writer.merge(
          result.toUIMessageStream({
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
          }),
        );
      },
    });

    return createUIMessageStreamResponse({ stream: uiStream });
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
