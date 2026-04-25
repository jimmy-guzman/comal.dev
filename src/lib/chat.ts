import type { UIMessage } from "ai";
import { and, count, desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { z } from "zod";

import { chatMessage, conversation } from "@/db/schemas/chat-schema";
import { Database } from "@/db/service";
import { DatabaseError, ForbiddenError, NotFoundError } from "@/lib/errors";

const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  state: z.enum(["streaming", "done"]).optional(),
});

const reasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
  state: z.enum(["streaming", "done"]).optional(),
});

const stepStartPartSchema = z.object({
  type: z.literal("step-start"),
});

const toolStateSchema = z.enum([
  "input-streaming",
  "input-available",
  "approval-requested",
  "output-available",
  "output-error",
]);

const dynamicToolPartSchema = z.object({
  type: z.literal("dynamic-tool"),
  toolName: z.string(),
  toolCallId: z.string(),
  state: toolStateSchema,
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
});

const filePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.string(),
  url: z.string(),
  filename: z.string().optional(),
});

const sourceUrlPartSchema = z.object({
  type: z.literal("source-url"),
  sourceId: z.string(),
  url: z.string(),
  title: z.string().optional(),
});

const toolCallPartSchema = z.object({
  type: z.literal("tool-call"),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(),
});

const toolResultPartSchema = z.object({
  type: z.literal("tool-result"),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
});

const uiMessagePartSchema = z.union([
  textPartSchema,
  reasoningPartSchema,
  stepStartPartSchema,
  dynamicToolPartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
  filePartSchema,
  sourceUrlPartSchema,
  z.object({ type: z.string() }).passthrough(),
]);

const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(uiMessagePartSchema),
});

export const parseStoredMessages = (
  rows: Array<{ id: string; role: string; parts: unknown }>,
): UIMessage[] =>
  rows.flatMap((row) => {
    const result = uiMessageSchema.safeParse(row);
    return result.success ? [result.data as UIMessage] : [];
  });

export const listConversationsForAgent = (
  userId: string,
  agentId: string,
): Effect.Effect<
  Array<{
    id: string;
    title: string | null;
    modelId: string;
    createdAt: Date;
  }>,
  DatabaseError,
  Database
> =>
  Effect.gen(function* () {
    const db = yield* Database;
    return yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: conversation.id,
            title: conversation.title,
            modelId: conversation.modelId,
            createdAt: conversation.createdAt,
          })
          .from(conversation)
          .where(and(eq(conversation.userId, userId), eq(conversation.agentId, agentId)))
          .orderBy(desc(conversation.createdAt))
          .limit(20),
      catch: (cause) => new DatabaseError({ cause }),
    });
  });

export const createConversation = ({
  userId,
  agentId,
  title,
  modelId,
}: {
  userId: string;
  agentId: string;
  title: string;
  modelId: string;
}): Effect.Effect<{ id: string }, DatabaseError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database;
    const id = nanoid();
    yield* Effect.tryPromise({
      try: () => db.insert(conversation).values({ id, userId, agentId, modelId, title }),
      catch: (cause) => new DatabaseError({ cause }),
    });
    return { id };
  });

export const getConversationWithMessages = (
  userId: string,
  conversationId: string,
): Effect.Effect<
  typeof conversation.$inferSelect & { messages: (typeof chatMessage.$inferSelect)[] },
  NotFoundError | ForbiddenError | DatabaseError,
  Database
> =>
  Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(conversation)
          .where(eq(conversation.id, conversationId))
          .limit(1),
      catch: (cause) => new DatabaseError({ cause }),
    });

    const conv = rows[0];

    if (!conv) {
      return yield* Effect.fail(new NotFoundError({ resource: "conversation" }));
    }

    if (conv.userId !== userId) {
      return yield* Effect.fail(new ForbiddenError());
    }

    const messages = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(chatMessage)
          .where(eq(chatMessage.conversationId, conversationId))
          .orderBy(chatMessage.createdAt),
      catch: (cause) => new DatabaseError({ cause }),
    });

    return { ...conv, messages };
  });

export const assertConversationAccess = (
  userId: string,
  conversationId: string,
): Effect.Effect<void, ForbiddenError | DatabaseError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ userId: conversation.userId })
          .from(conversation)
          .where(eq(conversation.id, conversationId))
          .limit(1),
      catch: (cause) => new DatabaseError({ cause }),
    });

    if (rows[0]?.userId !== userId) {
      return yield* Effect.fail(new ForbiddenError());
    }
  });

export const getConversationAgent = (
  conversationId: string,
): Effect.Effect<
  { agentId: string; modelId: string },
  NotFoundError | DatabaseError,
  Database
> =>
  Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ agentId: conversation.agentId, modelId: conversation.modelId })
          .from(conversation)
          .where(eq(conversation.id, conversationId))
          .limit(1),
      catch: (cause) => new DatabaseError({ cause }),
    });

    const conv = rows[0];

    if (!conv) {
      return yield* Effect.fail(new NotFoundError({ resource: "conversation" }));
    }

    return conv;
  });

export const updateConversationTitle = (
  conversationId: string,
  title: string,
): Effect.Effect<void, DatabaseError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database;
    yield* Effect.tryPromise({
      try: () =>
        db.update(conversation).set({ title }).where(eq(conversation.id, conversationId)),
      catch: (cause) => new DatabaseError({ cause }),
    });
  });

export const updateConversationModel = (
  conversationId: string,
  modelId: string,
): Effect.Effect<void, DatabaseError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database;
    yield* Effect.tryPromise({
      try: () =>
        db.update(conversation).set({ modelId }).where(eq(conversation.id, conversationId)),
      catch: (cause) => new DatabaseError({ cause }),
    });
  });

export const getConversationMessageCount = (
  conversationId: string,
): Effect.Effect<number, DatabaseError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: count() })
          .from(chatMessage)
          .where(eq(chatMessage.conversationId, conversationId)),
      catch: (cause) => new DatabaseError({ cause }),
    });

    return rows[0]?.count ?? 0;
  });

export const insertChatMessage = ({
  id,
  conversationId,
  role,
  parts,
  modelId,
}: {
  id?: string;
  conversationId: string;
  role: string;
  parts: unknown;
  modelId?: string | null;
}): Effect.Effect<void, DatabaseError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database;
    yield* Effect.tryPromise({
      try: () =>
        db.insert(chatMessage).values({
          id: id ?? nanoid(),
          conversationId,
          role,
          parts: parts as Record<string, unknown>,
          modelId: modelId ?? null,
        }),
      catch: (cause) => new DatabaseError({ cause }),
    });
  });

export const migrateAnonymousUserData = async ({
  anonymousUserId,
  newUserId,
}: {
  anonymousUserId: string;
  newUserId: string;
}) => {
  const { db } = await import("@/db/client");
  await db
    .update(conversation)
    .set({ userId: newUserId })
    .where(eq(conversation.userId, anonymousUserId));
};
