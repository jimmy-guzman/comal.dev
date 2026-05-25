import type { InferUIMessageChunk } from "ai";

import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  embedMany,
  generateText,
  isToolUIPart,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
} from "ai";
import { Effect, Logger, Schema } from "effect";
import { nanoid } from "nanoid";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import type { Database } from "@/db/service";
import type { AppUIMessage } from "@/lib/app-ui-message";
import type { ChatEventRow } from "@/lib/chat/projector";
import type { ChatStreamContext } from "@/lib/chat/stream-context";
import type {
  AgentNotFoundError,
  ConversationNotFoundError,
  DatabaseError,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/errors";

import { loadAgent } from "@/agents";
import { appRuntime } from "@/db/runtime";
import { Auth, AuthLive } from "@/lib/auth-context";
import { ChatService } from "@/lib/chat";
import { chatErrorCopyFor, classifyChatError } from "@/lib/chat/errors";
import { ChatPersistService, persistChatStream } from "@/lib/chat/persist-stream";
import { ChatStoreService } from "@/lib/chat/store";
import {
  LLMError,
  MessageConversionError,
  RateLimitCheckError,
  ValidationError,
} from "@/lib/errors";
import { MemoryService } from "@/lib/memory";
import { openrouter } from "@/lib/openrouter";
import {
  chatLimiter,
  chatLimiterAnon,
  checkBudget,
  checkLimit,
  pickLimiter,
  recordSpend,
} from "@/lib/rate-limit";

// eslint-disable-next-line unicorn/throw-new-error -- false positive: Schema.TaggedError is a class factory
class RateLimitError extends Schema.TaggedError<RateLimitError>()("RateLimitError", {
  limit: Schema.Number,
  message: Schema.String,
  reset: Schema.Number,
}) {}

// eslint-disable-next-line unicorn/throw-new-error -- false positive: Schema.TaggedError is a class factory
class BudgetExceededError extends Schema.TaggedError<BudgetExceededError>()("BudgetExceededError", {
  budgetMicrodollars: Schema.Number,
  message: Schema.String,
  spentMicrodollars: Schema.Number,
}) {}

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
  void appRuntime.runPromise(Effect.logError(message, error));
};

const MEMORY_EMBEDDING_MODEL_ID = "openai/text-embedding-3-small";
const MEMORY_TOP_K = 5;
const MEMORY_THRESHOLD = 0.75;

const lookupMemoryBlock = (userId: string, query: string) => {
  return Effect.gen(function* () {
    const trimmed = query.trim();

    if (trimmed.length === 0) return null;

    const { embedding } = yield* Effect.tryPromise({
      catch: (cause) => {
        return new LLMError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: "Failed to embed user message for memory lookup.",
        });
      },
      try: () => {
        return embed({
          // eslint-disable-next-line @typescript-eslint/no-deprecated -- OpenRouter SDK still uses the v4-named API
          model: openrouter.textEmbeddingModel(MEMORY_EMBEDDING_MODEL_ID),
          value: trimmed,
        });
      },
    });

    const hits = yield* MemoryService.search(userId, embedding, {
      limit: MEMORY_TOP_K,
      threshold: MEMORY_THRESHOLD,
    });

    if (hits.length === 0) return null;

    const lines = hits.map((hit) => `- ${hit.content}`).join("\n");

    return `<memory>\nFacts about the user from prior conversations:\n${lines}\n</memory>`;
  });
};

const embedPendingMemories = (userId: string) => {
  return Effect.gen(function* () {
    const pending = yield* MemoryService.listPendingEmbeddings(userId);

    if (pending.length === 0) return;

    const { embeddings } = yield* Effect.tryPromise({
      catch: (cause) => {
        return new LLMError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: "Failed to embed pending memories.",
        });
      },
      try: () => {
        return embedMany({
          // eslint-disable-next-line @typescript-eslint/no-deprecated -- OpenRouter SDK still uses the v4-named API
          model: openrouter.textEmbeddingModel(MEMORY_EMBEDDING_MODEL_ID),
          values: pending.map((row) => row.content),
        });
      },
    });

    const updates = pending.map((row, index) => {
      return { embedding: embeddings[index], id: row.id };
    });

    yield* MemoryService.setEmbeddings(updates);
  });
};

const errorToResponse = (
  error:
    | AgentNotFoundError
    | BudgetExceededError
    | ConversationNotFoundError
    | DatabaseError
    | ForbiddenError
    | MessageConversionError
    | RateLimitCheckError
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

  if (error._tag === "AgentNotFoundError") {
    return Response.json({ error: "Agent not found." }, { status: 404 });
  }

  if (error._tag === "ConversationNotFoundError") {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (error._tag === "RateLimitError") {
    const retryAfterSeconds = Math.max(1, Math.ceil((error.reset - Date.now()) / 1000));
    const copy = chatErrorCopyFor("rate-limit");

    return Response.json(
      {
        kind: copy.kind,
        message: copy.message,
        retryable: copy.retryable,
        statusCode: 429,
        suggestModelSwitch: copy.suggestModelSwitch,
      },
      { headers: { "Retry-After": String(retryAfterSeconds) }, status: 429 },
    );
  }

  if (error._tag === "BudgetExceededError") {
    const copy = chatErrorCopyFor("rate-limit");

    return Response.json(
      {
        kind: copy.kind,
        message: "Hourly usage budget exceeded. Try a cheaper model or wait for the next hour.",
        retryable: copy.retryable,
        statusCode: 429,
        suggestModelSwitch: true,
      },
      { headers: { "Retry-After": "3600" }, status: 429 },
    );
  }

  if (error._tag === "RateLimitCheckError") {
    return Response.json({ error: "Rate limit check failed." }, { status: 500 });
  }

  return Response.json({ error: "Internal server error." }, { status: 500 });
};

interface ApprovalResponseEvent {
  approval: { approved: boolean; id: string; reason?: string };
  messageId: string;
  toolCallId: string;
  toolName: string;
}

const extractApprovalResponses = (messages: AppUIMessage[]): ApprovalResponseEvent[] => {
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

const stringifyText = (parts: AppUIMessage["parts"]): string => {
  return parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(" ");
};

const generateTitleEffect = (
  conversationId: string,
  modelId: string,
  userText: string,
  userId: string,
): Effect.Effect<string, DatabaseError | LLMError, ChatService | Database> => {
  return Effect.gen(function* () {
    const { text: title } = yield* Effect.tryPromise({
      catch: (cause) => {
        return new LLMError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: cause instanceof Error ? cause.message : String(cause),
        });
      },
      try: () => {
        return generateText({
          model: openrouter(modelId),
          prompt: `Summarize the following user message in 4 to 6 words. Return only the title, no punctuation, no quotes.\n\nUser: ${userText}`,
        });
      },
    });

    const trimmed = title.trim();

    yield* ChatService.updateTitle(conversationId, trimmed);

    revalidateTag(`conversations:${userId}`, "max");

    return trimmed;
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
    | AgentNotFoundError
    | BudgetExceededError
    | ConversationNotFoundError
    | DatabaseError
    | ForbiddenError
    | MessageConversionError
    | RateLimitCheckError
    | RateLimitError
    | UnauthorizedError
    | ValidationError;

  const program = Effect.gen(function* () {
    const { user } = yield* Auth;

    const limiter = pickLimiter({ anon: chatLimiterAnon, authed: chatLimiter }, user);

    const { limit, reset, success } = yield* Effect.tryPromise({
      catch: (cause) => {
        return new RateLimitCheckError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: "Failed to check rate limit.",
        });
      },
      try: () => checkLimit(limiter, user.id),
    });

    if (!success) {
      return yield* Effect.fail(
        new RateLimitError({ limit, message: "Rate limit exceeded.", reset }),
      );
    }

    const budget = yield* Effect.tryPromise({
      catch: (cause) => {
        return new RateLimitCheckError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: "Failed to check budget.",
        });
      },
      try: () => checkBudget(user.id, user.isAnonymous === true),
    });

    if (!budget.success) {
      return yield* Effect.fail(
        new BudgetExceededError({
          budgetMicrodollars: budget.budgetMicrodollars,
          message: "Budget exceeded.",
          spentMicrodollars: budget.spentMicrodollars,
        }),
      );
    }

    const incomingMessages = parsed.data.messages.filter((msg) => {
      if (typeof msg !== "object" || msg === null) return true;

      const { parts } = msg as { parts?: unknown };

      return !Array.isArray(parts) || parts.length > 0;
    });

    let conversationId: string;
    let convModelId: string;
    let existingEvents: ChatEventRow[] = [];
    let isNewConversation = false;
    let resolvedAgentId: string;

    if (conversationSource.kind === "create") {
      resolvedAgentId = conversationSource.agentId;
      convModelId = conversationSource.modelId;
    } else {
      const conv = yield* ChatStoreService.getConversationWithEvents(
        user.id,
        conversationSource.conversationId,
      );

      resolvedAgentId = conv.agentId;
      convModelId = conv.modelId;
      existingEvents = conv.events;
    }

    const agent = yield* loadAgent(resolvedAgentId, user.id);

    const validation = yield* Effect.tryPromise({
      catch: (cause) => {
        return new ValidationError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: "Failed to validate messages.",
        });
      },
      try: () => {
        return safeValidateUIMessages<AppUIMessage>({
          messages: incomingMessages,
          tools: agent.tools,
        });
      },
    });

    if (!validation.success) {
      return yield* Effect.fail(new ValidationError({ message: validation.error.message }));
    }

    const userMessage = validation.data.toReversed().find((m) => {
      return m.role === "user";
    });

    if (conversationSource.kind === "create") {
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

      const created = yield* ChatService.createWithFirstUserMessage({
        agentId: conversationSource.agentId,
        agentVersionId: agent.versionId,
        modelId: conversationSource.modelId,
        title: "New conversation",
        userId: user.id,
        userMessage: { id: userMessage.id, parts: userMessage.parts },
      });

      conversationId = created.id;
      isNewConversation = true;

      revalidateTag(`conversations:${user.id}`, "max");
    } else {
      conversationId = conversationSource.conversationId;

      if (agent.versionId !== null) {
        yield* ChatService.setAgentVersion(conversationId, agent.versionId);
      }
    }

    const persistedUserMessageIds = new Set<string>();

    for (const event of existingEvents) {
      if (event.eventType === "user-message" && event.messageId !== null) {
        persistedUserMessageIds.add(event.messageId);
      }
    }

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

    const isFirstTurn =
      isNewConversation || (yield* ChatStoreService.countAssistantTurns(conversationId)) === 0;

    if (userMessage && !persistedUserMessageIds.has(userMessage.id)) {
      yield* ChatPersistService.appendChatEvent({
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
      yield* ChatPersistService.appendChatEvent({
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
      catch: (cause) => {
        return new MessageConversionError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: "Failed to convert messages.",
        });
      },
      try: () => {
        return convertToModelMessages(validation.data, { ignoreIncompleteToolCalls: true });
      },
    });

    const baseSystemPrompt = timezone
      ? `${agent.systemPrompt}\n\nThe user's local timezone is ${timezone}.`
      : agent.systemPrompt;

    const memoryBlock =
      agent.enableMemory && userMessage
        ? yield* lookupMemoryBlock(user.id, stringifyText(userMessage.parts)).pipe(
            Effect.tapError((cause) => {
              return Effect.logError("memory auto-injection failed", cause);
            }),
            Effect.catchAll(() => Effect.succeed(null)),
          )
        : null;

    const systemPrompt = memoryBlock ? `${baseSystemPrompt}\n\n${memoryBlock}` : baseSystemPrompt;

    const lastMessage = validation.data.at(-1);
    const assistantMessageId = lastMessage?.role === "assistant" ? lastMessage.id : nanoid();

    const streamContext = {
      conversationId,
      modelId: convModelId,
    } satisfies ChatStreamContext;

    const result = streamText({
      experimental_context: streamContext,
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
        const { costMicrodollars } = await persistChatStream({
          conversationId,
          fullStream: result.fullStream,
          messageId: assistantMessageId,
          modelId: convModelId,
          onEventError: (error, event) => {
            logError(`persistChatStream event error (${event.eventType})`, error);
          },
        });

        if (costMicrodollars !== null && costMicrodollars > 0) {
          await recordSpend(user.id, costMicrodollars);
        }
      } catch (error) {
        logError("after() persistence failed", error);
      }

      try {
        await appRuntime.runPromise(
          embedPendingMemories(user.id).pipe(
            Effect.tapError((cause) => {
              return Effect.logError("memory embed pipeline failed", cause);
            }),
            Effect.catchAll(() => Effect.void),
          ),
        );
      } catch (error) {
        logError("memory embed pipeline failed", error);
      }
    });

    const uiStream = createUIMessageStream<AppUIMessage>({
      execute: async ({ writer }) => {
        if (isNewConversation) {
          writer.write({
            data: { id: conversationId },
            transient: true,
            type: "data-conversation-created",
          });
        }

        const resolvedToolInputs = new Set<string>();

        const uiMessageStream = result
          .toUIMessageStream({
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
          })
          .pipeThrough(
            new TransformStream<
              InferUIMessageChunk<AppUIMessage>,
              InferUIMessageChunk<AppUIMessage>
            >({
              transform(chunk, controller) {
                if (chunk.type === "tool-input-delta" && resolvedToolInputs.has(chunk.toolCallId)) {
                  return;
                }

                if (chunk.type === "tool-input-available") {
                  resolvedToolInputs.add(chunk.toolCallId);
                }

                controller.enqueue(chunk);
              },
            }),
          );

        writer.merge(uiMessageStream);

        if (isFirstTurn && userMessage) {
          try {
            await result.finishReason;

            const userText = stringifyText(userMessage.parts).slice(0, 500);
            const title = await appRuntime.runPromise(
              generateTitleEffect(conversationId, convModelId, userText, user.id).pipe(
                Effect.tapError((error) => {
                  return Effect.logError("Title generation failed", error);
                }),
                Effect.catchAll(() => Effect.succeed(null)),
                Effect.provide(Logger.pretty),
              ),
            );

            if (title !== null) {
              writer.write({
                data: { id: conversationId, title },
                transient: true,
                type: "data-conversation-title",
              });
            }
          } catch (error) {
            logError("inline title generation failed", error);
          }
        }
      },
    });

    return createUIMessageStreamResponse({ stream: uiStream });
  }) satisfies Effect.Effect<
    Response,
    ChatError,
    Auth | ChatPersistService | ChatService | ChatStoreService | Database | MemoryService
  >;

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
