import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { Effect } from "effect";

import type { DatabaseError } from "@/lib/errors";

import { chatEvent, conversation } from "@/db/schemas/chat-schema";
import { agentEvalRun } from "@/db/schemas/eval-schema";
import { Database, runQuery } from "@/db/service";

interface RollupOptions {
  since?: Date;
}

interface ModelCost {
  microdollars: number;
  modelId: null | string;
}

interface ConversationCost {
  conversationId: string;
  microdollars: number;
  title: string;
  turnCount: number;
}

interface AgentCostRollup {
  averagePerTurnMicrodollars: number;
  byConversation: ConversationCost[];
  byModel: ModelCost[];
  totalMicrodollars: number;
  turnCount: number;
}

export interface AgentSpendPoint {
  date: string;
  microdollars: number;
}

interface EvalSuiteRunCost {
  ranAt: Date;
  runCount: number;
  suiteRunId: string;
  totalMicrodollars: number;
}

interface EvalCostSummary {
  suiteRuns: EvalSuiteRunCost[];
  totalMicrodollars: number;
}

/**
 * Cost lives on `assistant-turn-finish` events only, so every cost query scopes
 * to those rows of an owner's chat conversations, with an optional `since` floor.
 * Sub-agent inner turns are kept in the sum: their `chat_event` rows carry real
 * cost, so an agent's spend includes the work its sub-agents did.
 */
const chatTurnFilters = (agentId: string, userId: string, since: Date | undefined) => {
  const filters = [
    eq(conversation.agentId, agentId),
    eq(conversation.userId, userId),
    eq(conversation.kind, "chat"),
    eq(chatEvent.eventType, "assistant-turn-finish"),
  ];

  if (since) filters.push(gte(chatEvent.createdAt, since));

  return and(...filters);
};

export const getAgentCostRollup = (
  agentId: string,
  userId: string,
  options: RollupOptions = {},
): Effect.Effect<AgentCostRollup, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;
    const where = chatTurnFilters(agentId, userId, options.since);

    const modelRows = yield* runQuery(() => {
      return db
        .select({
          microdollars: sql<number>`coalesce(sum(${chatEvent.costMicrodollars}), 0)::int`.as(
            "microdollars",
          ),
          modelId: chatEvent.modelId,
        })
        .from(chatEvent)
        .innerJoin(conversation, eq(conversation.id, chatEvent.conversationId))
        .where(where)
        .groupBy(chatEvent.modelId)
        .orderBy(sql`microdollars desc`);
    });

    const conversationRows = yield* runQuery(() => {
      return db
        .select({
          conversationId: chatEvent.conversationId,
          microdollars: sql<number>`coalesce(sum(${chatEvent.costMicrodollars}), 0)::int`.as(
            "microdollars",
          ),
          title: conversation.title,
          turnCount:
            sql<number>`(count(*) filter (where ${chatEvent.parentToolCallId} is null))::int`.as(
              "turn_count",
            ),
        })
        .from(chatEvent)
        .innerJoin(conversation, eq(conversation.id, chatEvent.conversationId))
        .where(where)
        .groupBy(chatEvent.conversationId, conversation.title)
        .orderBy(sql`microdollars desc`);
    });

    const totalMicrodollars = modelRows.reduce((sum, row) => {
      return sum + row.microdollars;
    }, 0);
    const turnCount = conversationRows.reduce((sum, row) => sum + row.turnCount, 0);

    return {
      averagePerTurnMicrodollars: turnCount === 0 ? 0 : Math.round(totalMicrodollars / turnCount),
      byConversation: conversationRows,
      byModel: modelRows,
      totalMicrodollars,
      turnCount,
    };
  });
};

export const getAgentSpendByDay = (
  agentId: string,
  userId: string,
  options: RollupOptions = {},
): Effect.Effect<AgentSpendPoint[], DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;
    const where = chatTurnFilters(agentId, userId, options.since);
    const day = sql`date_trunc('day', ${chatEvent.createdAt})`;

    return yield* runQuery(() => {
      return db
        .select({
          date: sql<string>`to_char(${day}, 'YYYY-MM-DD')`.as("date"),
          microdollars: sql<number>`coalesce(sum(${chatEvent.costMicrodollars}), 0)::int`.as(
            "microdollars",
          ),
        })
        .from(chatEvent)
        .innerJoin(conversation, eq(conversation.id, chatEvent.conversationId))
        .where(where)
        .groupBy(day)
        .orderBy(day);
    });
  });
};

interface EvalCostOptions {
  limit?: number;
  since?: Date;
}

export const getEvalSuiteRunCosts = (
  agentId: string,
  userId: string,
  options: EvalCostOptions = {},
): Effect.Effect<EvalCostSummary, DatabaseError, Database> => {
  return Effect.gen(function* () {
    const db = yield* Database;
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);

    const totalFilters = [
      eq(conversation.agentId, agentId),
      eq(conversation.userId, userId),
      eq(conversation.kind, "eval"),
      eq(chatEvent.eventType, "assistant-turn-finish"),
    ];

    if (options.since) totalFilters.push(gte(chatEvent.createdAt, options.since));

    const totalRows = yield* runQuery(() => {
      return db
        .select({
          microdollars: sql<number>`coalesce(sum(${chatEvent.costMicrodollars}), 0)::int`.as(
            "microdollars",
          ),
        })
        .from(chatEvent)
        .innerJoin(conversation, eq(conversation.id, chatEvent.conversationId))
        .where(and(...totalFilters));
    });

    const suiteFilters = [
      eq(conversation.agentId, agentId),
      eq(conversation.userId, userId),
      eq(chatEvent.eventType, "assistant-turn-finish"),
      isNotNull(agentEvalRun.suiteRunId),
    ];

    if (options.since) suiteFilters.push(gte(chatEvent.createdAt, options.since));

    const suiteRows = yield* runQuery(() => {
      return db
        .select({
          ranAt: sql<Date>`max(${agentEvalRun.createdAt})`.as("ran_at"),
          runCount: sql<number>`(count(distinct ${agentEvalRun.id}))::int`.as("run_count"),
          suiteRunId: agentEvalRun.suiteRunId,
          totalMicrodollars: sql<number>`coalesce(sum(${chatEvent.costMicrodollars}), 0)::int`.as(
            "total_microdollars",
          ),
        })
        .from(agentEvalRun)
        .innerJoin(conversation, eq(conversation.id, agentEvalRun.conversationId))
        .innerJoin(chatEvent, eq(chatEvent.conversationId, conversation.id))
        .where(and(...suiteFilters))
        .groupBy(agentEvalRun.suiteRunId)
        .orderBy(sql`ran_at desc`)
        .limit(limit);
    });

    return {
      suiteRuns: suiteRows.flatMap((row) => {
        if (row.suiteRunId === null) return [];

        return [{ ...row, ranAt: new Date(row.ranAt), suiteRunId: row.suiteRunId }];
      }),
      totalMicrodollars: totalRows[0]?.microdollars ?? 0,
    };
  });
};
