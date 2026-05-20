import { and, count, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import type { DatabaseError } from "@/lib/errors";

import { chatEvent, conversation } from "@/db/schemas/chat-schema";
import { Database, runQuery } from "@/db/service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

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

    const convRows = yield* runQuery(() => {
      return db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
    });

    const conv = convRows.at(0);

    if (conv === undefined) {
      return yield* Effect.fail(new NotFoundError({ resource: "conversation" }));
    }

    if (conv.userId !== userId) {
      return yield* Effect.fail(new ForbiddenError());
    }

    const eventRows = yield* runQuery(() => {
      return db
        .select({
          eventType: chatEvent.eventType,
          messageId: chatEvent.messageId,
          parentToolCallId: chatEvent.parentToolCallId,
          payload: chatEvent.payload,
          role: chatEvent.role,
          sequence: chatEvent.sequence,
        })
        .from(chatEvent)
        .where(eq(chatEvent.conversationId, conversationId))
        .orderBy(chatEvent.sequence);
    });

    const events = eventRows.flatMap((row): ChatEventRow[] => {
      if (!CHAT_EVENT_TYPES.has(row.eventType as ChatEventRow["eventType"])) return [];

      if (!CHAT_EVENT_ROLES.has(row.role as ChatEventRow["role"])) return [];

      return [
        {
          eventType: row.eventType as ChatEventRow["eventType"],
          messageId: row.messageId,
          parentToolCallId: row.parentToolCallId,
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

export interface TraceEventRow {
  createdAt: Date;
  endedAt: Date | null;
  eventType: string;
  messageId: null | string;
  modelId: null | string;
  parentToolCallId: null | string;
  payload: unknown;
  role: string;
  sequence: number;
  startedAt: Date | null;
}

interface ConversationTrace {
  conversationCreatedAt: Date;
  events: TraceEventRow[];
  id: string;
  modelId: string;
  title: string;
}

export const getConversationTrace = (
  userId: string,
  conversationId: string,
): Effect.Effect<ConversationTrace, DatabaseError | ForbiddenError | NotFoundError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const convRows = yield* runQuery(() => {
      return db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
    });

    const conv = convRows.at(0);

    if (conv === undefined) {
      return yield* Effect.fail(new NotFoundError({ resource: "conversation" }));
    }

    if (conv.userId !== userId) {
      return yield* Effect.fail(new ForbiddenError());
    }

    const eventRows = yield* runQuery(() => {
      return db
        .select({
          createdAt: chatEvent.createdAt,
          endedAt: chatEvent.endedAt,
          eventType: chatEvent.eventType,
          messageId: chatEvent.messageId,
          modelId: chatEvent.modelId,
          parentToolCallId: chatEvent.parentToolCallId,
          payload: chatEvent.payload,
          role: chatEvent.role,
          sequence: chatEvent.sequence,
          startedAt: chatEvent.startedAt,
        })
        .from(chatEvent)
        .where(eq(chatEvent.conversationId, conversationId))
        .orderBy(chatEvent.sequence);
    });

    return {
      conversationCreatedAt: conv.createdAt,
      events: eventRows,
      id: conv.id,
      modelId: conv.modelId,
      title: conv.title,
    };
  });
};

interface TraceSummary {
  conversationId: string;
  endedAt: Date;
  eventCount: number;
  startedAt: Date;
  totalCostMicrodollars: number;
}

export interface TraceListResult {
  nextCursor?: string;
  traces: TraceSummary[];
}

const encodeTraceCursor = (endedAt: Date, conversationId: string) => {
  return `${endedAt.toISOString()}|${conversationId}`;
};

const decodeTraceCursor = (
  cursor: string,
): undefined | { conversationId: string; endedAt: Date } => {
  const separator = cursor.indexOf("|");

  if (separator <= 0) return undefined;

  const endedAt = new Date(cursor.slice(0, separator));
  const conversationId = cursor.slice(separator + 1);

  if (conversationId.length === 0 || Number.isNaN(endedAt.getTime())) return undefined;

  return { conversationId, endedAt };
};

export const listTracesForAgent = (
  agentId: string,
  userId: string,
  options: { cursor?: string; limit?: number } = {},
): Effect.Effect<TraceListResult, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTraceCursor(options.cursor) : undefined;
    const lastEventAt = sql<Date>`max(coalesce(${chatEvent.endedAt}, ${chatEvent.createdAt}))`;

    const rows = yield* runQuery(() => {
      return db
        .select({
          conversationId: chatEvent.conversationId,
          endedAt: lastEventAt.as("ended_at"),
          eventCount: sql<number>`count(*)::int`.as("event_count"),
          startedAt: sql<Date>`min(${chatEvent.createdAt})`.as("started_at"),
          totalCostMicrodollars:
            sql<number>`coalesce(sum(${chatEvent.costMicrodollars}), 0)::int`.as(
              "total_cost_microdollars",
            ),
        })
        .from(chatEvent)
        .innerJoin(conversation, eq(conversation.id, chatEvent.conversationId))
        .where(and(eq(conversation.agentId, agentId), eq(conversation.userId, userId)))
        .groupBy(chatEvent.conversationId)
        .having(
          cursor
            ? sql`(${lastEventAt} < ${cursor.endedAt}) or (${lastEventAt} = ${cursor.endedAt} and ${chatEvent.conversationId} < ${cursor.conversationId})`
            : undefined,
        )
        .orderBy(sql`${lastEventAt} desc, ${chatEvent.conversationId} desc`)
        .limit(limit + 1);
    });

    const traces = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const lastRow = traces.at(-1);

    return {
      ...(hasMore && lastRow
        ? { nextCursor: encodeTraceCursor(new Date(lastRow.endedAt), lastRow.conversationId) }
        : {}),
      traces,
    };
  });
};

export const countAssistantTurns = (
  conversationId: string,
): Effect.Effect<number, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* runQuery(() => {
      return db
        .select({ count: count() })
        .from(chatEvent)
        .where(
          and(
            eq(chatEvent.conversationId, conversationId),
            eq(chatEvent.eventType, "assistant-turn-finish"),
          ),
        );
    });

    return rows[0]?.count ?? 0;
  });
};
