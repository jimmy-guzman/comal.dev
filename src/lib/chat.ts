import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent } from "@/db/schemas/agent-schema";
import { conversation } from "@/db/schemas/chat-schema";
import { Database } from "@/db/service";
import { DatabaseError, ForbiddenError, NotFoundError } from "@/lib/errors";

export const listRecentConversationsForUser = (
  userId: string,
  limit: number,
): Effect.Effect<
  {
    agentId: string;
    agentName: string;
    createdAt: Date;
    id: string;
    title: string;
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
            agentId: conversation.agentId,
            agentName: agent.name,
            createdAt: conversation.createdAt,
            id: conversation.id,
            title: conversation.title,
          })
          .from(conversation)
          .innerJoin(agent, and(eq(agent.id, conversation.agentId), eq(agent.userId, userId)))
          .where(eq(conversation.userId, userId))
          .orderBy(desc(conversation.createdAt))
          .limit(limit);
      },
    });
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

export const deleteConversation = (
  conversationId: string,
): Effect.Effect<void, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db.delete(conversation).where(eq(conversation.id, conversationId));
      },
    });
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
