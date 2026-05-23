import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { Effect } from "effect";

import { chatEvent, conversation } from "@/db/schemas/chat-schema";
import { agentEvalRun } from "@/db/schemas/eval-schema";
import { Database, runQuery } from "@/db/service";

interface RollupOptions {
  since?: Date;
}

export interface AgentSpendPoint {
  date: string;
  microdollars: number;
}

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

interface EvalCostOptions {
  limit?: number;
  since?: Date;
}

export class CostService extends Effect.Service<CostService>()("CostService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const getAgentRollup = Effect.fn("CostService.getAgentRollup")(function* (
      agentId: string,
      userId: string,
      options: RollupOptions = {},
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("userId", userId);

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
      const turnCount = conversationRows.reduce((sum, row) => {
        return sum + row.turnCount;
      }, 0);

      return {
        averagePerTurnMicrodollars: turnCount === 0 ? 0 : Math.round(totalMicrodollars / turnCount),
        byConversation: conversationRows,
        byModel: modelRows,
        totalMicrodollars,
        turnCount,
      };
    });

    const getAgentSpendByDay = Effect.fn("CostService.getAgentSpendByDay")(function* (
      agentId: string,
      userId: string,
      options: RollupOptions = {},
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("userId", userId);

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

    const getEvalSuiteRunCosts = Effect.fn("CostService.getEvalSuiteRunCosts")(function* (
      agentId: string,
      userId: string,
      options: EvalCostOptions = {},
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("userId", userId);

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
        eq(conversation.kind, "eval"),
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

    return { getAgentRollup, getAgentSpendByDay, getEvalSuiteRunCosts };
  }),
}) {}
