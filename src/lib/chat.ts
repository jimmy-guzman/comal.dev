import type { UIMessage } from "ai";

import { and, count, desc, eq } from "drizzle-orm";
import { Effect, Logger } from "effect";
import { nanoid } from "nanoid";
import { z } from "zod";

import { chatMessage, conversation } from "@/db/schemas/chat-schema";
import { Database } from "@/db/service";
import { DatabaseError, ForbiddenError, NotFoundError } from "@/lib/errors";

const textPartSchema = z.object({
  state: z.enum(["streaming", "done"]).optional(),
  text: z.string(),
  type: z.literal("text"),
});

const reasoningPartSchema = z.object({
  state: z.enum(["streaming", "done"]).optional(),
  text: z.string(),
  type: z.literal("reasoning"),
});

const stepStartPartSchema = z.object({
  type: z.literal("step-start"),
});

const approvalSchema = z.object({
  approved: z.boolean().optional(),
  id: z.string(),
  reason: z.string().optional(),
});

const dynamicToolPartSchema = z.discriminatedUnion("state", [
  z.object({
    approval: z.never().optional(),
    errorText: z.never().optional(),
    input: z.unknown().optional(),
    output: z.never().optional(),
    state: z.literal("input-streaming"),
    toolCallId: z.string(),
    toolName: z.string(),
    type: z.literal("dynamic-tool"),
  }),
  z.object({
    approval: z.never().optional(),
    errorText: z.never().optional(),
    input: z.unknown().optional(),
    output: z.never().optional(),
    state: z.literal("input-available"),
    toolCallId: z.string(),
    toolName: z.string(),
    type: z.literal("dynamic-tool"),
  }),
  z.object({
    approval: approvalSchema,
    errorText: z.never().optional(),
    input: z.unknown(),
    output: z.never().optional(),
    state: z.literal("approval-requested"),
    toolCallId: z.string(),
    toolName: z.string(),
    type: z.literal("dynamic-tool"),
  }),
  z.object({
    approval: approvalSchema,
    errorText: z.never().optional(),
    input: z.unknown(),
    output: z.never().optional(),
    state: z.literal("approval-responded"),
    toolCallId: z.string(),
    toolName: z.string(),
    type: z.literal("dynamic-tool"),
  }),
  z.object({
    approval: approvalSchema.optional(),
    errorText: z.never().optional(),
    input: z.unknown(),
    output: z.unknown(),
    state: z.literal("output-available"),
    toolCallId: z.string(),
    toolName: z.string(),
    type: z.literal("dynamic-tool"),
  }),
  z.object({
    approval: approvalSchema.optional(),
    errorText: z.string(),
    input: z.unknown(),
    output: z.never().optional(),
    state: z.literal("output-error"),
    toolCallId: z.string(),
    toolName: z.string(),
    type: z.literal("dynamic-tool"),
  }),
]);

const filePartSchema = z.object({
  filename: z.string().optional(),
  mediaType: z.string(),
  type: z.literal("file"),
  url: z.string(),
});

const sourceUrlPartSchema = z.object({
  sourceId: z.string(),
  title: z.string().optional(),
  type: z.literal("source-url"),
  url: z.string(),
});

const toolCallPartSchema = z.object({
  args: z.unknown(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("tool-call"),
});

const toolResultPartSchema = z.object({
  result: z.unknown(),
  toolCallId: z.string(),
  toolName: z.string(),
  type: z.literal("tool-result"),
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
  z.looseObject({ type: z.string() }),
]);

const uiMessageSchema = z.object({
  id: z.string(),
  parts: z.array(uiMessagePartSchema),
  role: z.enum(["system", "user", "assistant"]),
});

const KNOWN_PART_TYPES = new Set([
  "dynamic-tool",
  "file",
  "reasoning",
  "source-url",
  "step-start",
  "text",
  "tool-call",
  "tool-result",
]);

const logUnknownStaticToolPart = (part: { type: string }): void => {
  if (KNOWN_PART_TYPES.has(part.type) || !part.type.startsWith("tool-")) return;

  Effect.runSync(
    Effect.logWarning("Unrecognized static tool part fell through to loose schema", {
      part,
      type: part.type,
    }).pipe(Effect.provide(Logger.pretty)),
  );
};

export const parseStoredMessages = (
  rows: { id: string; parts: unknown; role: string }[],
): UIMessage[] => {
  return rows.flatMap((row) => {
    const result = uiMessageSchema.safeParse(row);

    if (!result.success) return [];

    for (const part of result.data.parts) {
      logUnknownStaticToolPart(part);
    }

    return [result.data as UIMessage];
  });
};

export const listConversationsForAgent = (
  userId: string,
  agentId: string,
): Effect.Effect<
  {
    createdAt: Date;
    id: string;
    modelId: string;
    title: null | string;
  }[],
  DatabaseError,
  Database
> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    return yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select({
            createdAt: conversation.createdAt,
            id: conversation.id,
            modelId: conversation.modelId,
            title: conversation.title,
          })
          .from(conversation)
          .where(and(eq(conversation.userId, userId), eq(conversation.agentId, agentId)))
          .orderBy(desc(conversation.createdAt))
          .limit(20);
      },
    });
  });
};

export const createConversation = ({
  agentId,
  modelId,
  title,
  userId,
}: {
  agentId: string;
  modelId: string;
  title: string;
  userId: string;
}): Effect.Effect<{ id: string }, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;
    const id = nanoid();

    yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db.insert(conversation).values({ agentId, id, modelId, title, userId });
      },
    });

    return { id };
  });
};

export const getConversationWithMessages = (
  userId: string,
  conversationId: string,
): Effect.Effect<
  typeof conversation.$inferSelect & { messages: (typeof chatMessage.$inferSelect)[] },
  DatabaseError | ForbiddenError | NotFoundError,
  Database
> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
      },
    });

    const conv = rows.at(0);

    if (conv === undefined) {
      return yield* Effect.fail(new NotFoundError({ resource: "conversation" }));
    }

    if (conv.userId !== userId) {
      return yield* Effect.fail(new ForbiddenError());
    }

    const messages = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select()
          .from(chatMessage)
          .where(eq(chatMessage.conversationId, conversationId))
          .orderBy(chatMessage.createdAt);
      },
    });

    return { ...conv, messages };
  });
};

export const assertConversationAccess = (
  userId: string,
  conversationId: string,
): Effect.Effect<void, DatabaseError | ForbiddenError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select({ userId: conversation.userId })
          .from(conversation)
          .where(eq(conversation.id, conversationId))
          .limit(1);
      },
    });

    yield* Effect.when(Effect.fail(new ForbiddenError()), () => {
      return rows[0]?.userId !== userId;
    });
  });
};

export const getConversationAgent = (
  conversationId: string,
): Effect.Effect<{ agentId: string; modelId: string }, DatabaseError | NotFoundError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select({ agentId: conversation.agentId, modelId: conversation.modelId })
          .from(conversation)
          .where(eq(conversation.id, conversationId))
          .limit(1);
      },
    });

    const conv = rows.at(0);

    if (conv === undefined) {
      return yield* Effect.fail(new NotFoundError({ resource: "conversation" }));
    }

    return conv;
  });
};

export const updateConversationTitle = (
  conversationId: string,
  title: string,
): Effect.Effect<void, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db.update(conversation).set({ title }).where(eq(conversation.id, conversationId));
      },
    });
  });
};

export const updateConversationModel = (
  conversationId: string,
  modelId: string,
): Effect.Effect<void, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db.update(conversation).set({ modelId }).where(eq(conversation.id, conversationId));
      },
    });
  });
};

export const getConversationMessageCount = (
  conversationId: string,
): Effect.Effect<number, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select({ count: count() })
          .from(chatMessage)
          .where(eq(chatMessage.conversationId, conversationId));
      },
    });

    return rows[0]?.count ?? 0;
  });
};

export const insertChatMessage = ({
  conversationId,
  id,
  modelId,
  parts,
  role,
}: {
  conversationId: string;
  id?: string;
  modelId?: null | string;
  parts: unknown;
  role: string;
}): Effect.Effect<void, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db.insert(chatMessage).values({
          conversationId,
          id: id ?? nanoid(),
          modelId: modelId ?? null,
          parts,
          role,
        }).onConflictDoNothing();
      },
    });
  });
};

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
