import { and, count, eq } from "drizzle-orm";
import { Effect } from "effect";

import { chatEvent, conversation } from "@/db/schemas/chat-schema";
import { Database } from "@/db/service";
import { DatabaseError, ForbiddenError, NotFoundError } from "@/lib/errors";

import type { ChatEventRow } from "./projector";

import { CHAT_EVENT_ROLES, CHAT_EVENT_TYPES } from "./events";

interface ConversationWithEvents {
  agentId: string;
  events: ChatEventRow[];
  id: string;
  modelId: string;
  title: string;
  userId: string;
}

export const getConversationWithEvents = (
  userId: string,
  conversationId: string,
): Effect.Effect<
  ConversationWithEvents,
  DatabaseError | ForbiddenError | NotFoundError,
  Database
> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const convRows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
      },
    });

    const conv = convRows.at(0);

    if (conv === undefined) {
      return yield* Effect.fail(new NotFoundError({ resource: "conversation" }));
    }

    if (conv.userId !== userId) {
      return yield* Effect.fail(new ForbiddenError());
    }

    const eventRows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select({
            eventType: chatEvent.eventType,
            messageId: chatEvent.messageId,
            payload: chatEvent.payload,
            role: chatEvent.role,
            sequence: chatEvent.sequence,
          })
          .from(chatEvent)
          .where(eq(chatEvent.conversationId, conversationId))
          .orderBy(chatEvent.sequence);
      },
    });

    const events = eventRows.flatMap((row): ChatEventRow[] => {
      if (!CHAT_EVENT_TYPES.has(row.eventType as ChatEventRow["eventType"])) return [];

      if (!CHAT_EVENT_ROLES.has(row.role as ChatEventRow["role"])) return [];

      return [
        {
          eventType: row.eventType as ChatEventRow["eventType"],
          messageId: row.messageId,
          payload: row.payload,
          role: row.role as ChatEventRow["role"],
          sequence: row.sequence,
        },
      ];
    });

    return {
      agentId: conv.agentId,
      events,
      id: conv.id,
      modelId: conv.modelId,
      title: conv.title,
      userId: conv.userId,
    };
  });
};

export const countAssistantTurns = (
  conversationId: string,
): Effect.Effect<number, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* Effect.tryPromise({
      catch: (cause) => new DatabaseError({ cause }),
      try: () => {
        return db
          .select({ count: count() })
          .from(chatEvent)
          .where(
            and(
              eq(chatEvent.conversationId, conversationId),
              eq(chatEvent.eventType, "assistant-turn-finish"),
            ),
          );
      },
    });

    return rows[0]?.count ?? 0;
  });
};
