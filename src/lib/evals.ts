import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent, agentVersion } from "@/db/schemas/agent-schema";
import { agentEval, agentEvalRun } from "@/db/schemas/eval-schema";
import { Database, runMutation, runQuery } from "@/db/service";
import { NotFoundError } from "@/lib/errors";

export interface EvalRunTrial {
  conversationId: null | string;
  id: string;
  output: string;
  score: number;
}

export interface EvalRunAggregate {
  count: number;
  max: number;
  mean: number;
  min: number;
  trials: EvalRunTrial[];
}

export interface EvalRunSummary {
  evalId: string;
  lastRunAggregate: EvalRunAggregate | null;
  lastRunAt: Date | null;
  lastRunConversationId: null | string;
  lastRunOutput: null | string;
  lastRunRationale: null | string;
  lastRunRunGroupId: null | string;
  lastRunScore: null | number;
}

interface EvalVersionRow {
  meanScore: number;
  runCount: number;
  versionCreatedAt: Date;
  versionId: string;
}

export interface EvalVersionScore extends EvalVersionRow {
  isRegression: boolean;
  ordinal: number;
}

interface EvalRunHistoryItem {
  agentVersionId: null | string;
  conversationId: null | string;
  createdAt: Date;
  evalId: string;
  id: string;
  output: string;
  rationale: null | string;
  runGroupId: null | string;
  score: number;
}

interface EvalRunHistoryResult {
  nextCursor?: string;
  runs: EvalRunHistoryItem[];
}

export const deriveEvalScoreTrend = (rows: EvalVersionRow[]): EvalVersionScore[] => {
  return rows.map((row, index) => {
    return {
      ...row,
      isRegression: index > 0 && row.meanScore < rows[index - 1].meanScore,
      ordinal: index + 1,
    };
  });
};

const encodeRunCursor = (createdAt: Date, id: string) => {
  return `${createdAt.toISOString()}|${id}`;
};

const decodeRunCursor = (cursor: string): undefined | { createdAt: Date; id: string } => {
  const separator = cursor.indexOf("|");

  if (separator <= 0) return undefined;

  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);

  if (id.length === 0 || Number.isNaN(createdAt.getTime())) return undefined;

  return { createdAt, id };
};

export const getEvalWithOwnership = (evalId: string, userId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* runQuery(() => {
      return db
        .select({
          agentId: agentEval.agentId,
          expected: agentEval.expected,
          id: agentEval.id,
          input: agentEval.input,
          name: agentEval.name,
          scorer: agentEval.scorer,
          trials: agentEval.trials,
        })
        .from(agentEval)
        .innerJoin(agent, eq(agent.id, agentEval.agentId))
        .where(and(eq(agentEval.id, evalId), eq(agent.userId, userId)))
        .limit(1);
    });

    const row = rows.at(0);

    if (!row) {
      return yield* Effect.fail(new NotFoundError({ resource: "eval" }));
    }

    return row;
  });
};

export const listEvalRunsForAgent = (agentId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const latestRun = db
      .select({
        conversationId: agentEvalRun.conversationId,
        createdAt: agentEvalRun.createdAt,
        evalId: agentEvalRun.evalId,
        output: agentEvalRun.output,
        rationale: agentEvalRun.rationale,
        rowNum:
          sql<number>`row_number() over (partition by ${agentEvalRun.evalId} order by ${agentEvalRun.createdAt} desc)`.as(
            "row_num",
          ),
        runGroupId: agentEvalRun.runGroupId,
        score: agentEvalRun.score,
      })
      .from(agentEvalRun)
      .as("latest_run");

    const latestRows = yield* runQuery(() => {
      return db
        .select({
          evalId: latestRun.evalId,
          lastRunAt: latestRun.createdAt,
          lastRunConversationId: latestRun.conversationId,
          lastRunOutput: latestRun.output,
          lastRunRationale: latestRun.rationale,
          lastRunRunGroupId: latestRun.runGroupId,
          lastRunScore: latestRun.score,
        })
        .from(latestRun)
        .innerJoin(agentEval, eq(agentEval.id, latestRun.evalId))
        .where(and(eq(agentEval.agentId, agentId), eq(latestRun.rowNum, 1)));
    });

    const groupIds = latestRows
      .map((row) => row.lastRunRunGroupId)
      .filter((id): id is string => id !== null);

    const groupAggregates = new Map<string, EvalRunAggregate>();

    if (groupIds.length > 0) {
      const groupRows = yield* runQuery(() => {
        return db
          .select({
            conversationId: agentEvalRun.conversationId,
            id: agentEvalRun.id,
            output: agentEvalRun.output,
            runGroupId: agentEvalRun.runGroupId,
            score: agentEvalRun.score,
          })
          .from(agentEvalRun)
          .where(inArray(agentEvalRun.runGroupId, groupIds))
          .orderBy(agentEvalRun.runGroupId, agentEvalRun.createdAt, agentEvalRun.id);
      });

      const buckets = new Map<string, EvalRunTrial[]>();

      for (const row of groupRows) {
        if (!row.runGroupId) continue;

        const existing = buckets.get(row.runGroupId) ?? [];

        existing.push({
          conversationId: row.conversationId,
          id: row.id,
          output: row.output,
          score: row.score,
        });
        buckets.set(row.runGroupId, existing);
      }

      for (const [id, trials] of buckets) {
        if (trials.length === 0) continue;

        const scores = trials.map((trial) => trial.score);
        const sum = scores.reduce((acc, value) => acc + value, 0);

        groupAggregates.set(id, {
          count: trials.length,
          max: Math.max(...scores),
          mean: sum / trials.length,
          min: Math.min(...scores),
          trials,
        });
      }
    }

    return latestRows.map((row): EvalRunSummary => {
      return {
        ...row,
        lastRunAggregate: row.lastRunRunGroupId
          ? (groupAggregates.get(row.lastRunRunGroupId) ?? null)
          : null,
      };
    });
  });
};

export const getEvalScoreTrend = (agentId: string) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const rows = yield* runQuery(() => {
      return db
        .select({
          meanScore: sql<number>`avg(${agentEvalRun.score})::float8`,
          runCount: sql<number>`count(*)::int`,
          versionCreatedAt: agentVersion.createdAt,
          versionId: agentVersion.id,
        })
        .from(agentEvalRun)
        .innerJoin(agentVersion, eq(agentVersion.id, agentEvalRun.agentVersionId))
        .where(eq(agentVersion.agentId, agentId))
        .groupBy(agentVersion.id, agentVersion.createdAt)
        .orderBy(agentVersion.createdAt);
    });

    return deriveEvalScoreTrend(rows);
  });
};

export const listEvalRunHistory = (
  agentId: string,
  options: { cursor?: string; evalId?: string; limit?: number } = {},
) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeRunCursor(options.cursor) : undefined;

    const rows = yield* runQuery(() => {
      return db
        .select({
          agentVersionId: agentEvalRun.agentVersionId,
          conversationId: agentEvalRun.conversationId,
          createdAt: agentEvalRun.createdAt,
          evalId: agentEvalRun.evalId,
          id: agentEvalRun.id,
          output: agentEvalRun.output,
          rationale: agentEvalRun.rationale,
          runGroupId: agentEvalRun.runGroupId,
          score: agentEvalRun.score,
        })
        .from(agentEvalRun)
        .innerJoin(agentEval, eq(agentEval.id, agentEvalRun.evalId))
        .where(
          and(
            eq(agentEval.agentId, agentId),
            options.evalId ? eq(agentEvalRun.evalId, options.evalId) : undefined,
            cursor
              ? sql`(${agentEvalRun.createdAt} < ${cursor.createdAt}) or (${agentEvalRun.createdAt} = ${cursor.createdAt} and ${agentEvalRun.id} < ${cursor.id})`
              : undefined,
          ),
        )
        .orderBy(desc(agentEvalRun.createdAt), desc(agentEvalRun.id))
        .limit(limit + 1);
    });

    const runs = rows.slice(0, limit);
    const lastRow = runs.at(-1);
    const hasMore = rows.length > limit;

    return {
      nextCursor: hasMore && lastRow ? encodeRunCursor(lastRow.createdAt, lastRow.id) : undefined,
      runs,
    } satisfies EvalRunHistoryResult;
  });
};

interface EvalRunInsert {
  agentVersionId?: null | string;
  conversationId?: null | string;
  evalId: string;
  id?: string;
  output: string;
  rationale?: null | string;
  runGroupId?: null | string;
  score: number;
}

export const createEvalRun = (input: EvalRunInsert) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* runMutation(() => {
      return db.insert(agentEvalRun).values({
        agentVersionId: input.agentVersionId ?? null,
        conversationId: input.conversationId ?? null,
        evalId: input.evalId,
        id: input.id ?? nanoid(),
        output: input.output,
        rationale: input.rationale ?? null,
        runGroupId: input.runGroupId ?? null,
        score: input.score,
      });
    });
  });
};

export const createEvalRuns = (inputs: EvalRunInsert[]) => {
  return Effect.gen(function* () {
    if (inputs.length === 0) return;

    const db = yield* Database;

    const rows = inputs.map((input) => {
      return {
        agentVersionId: input.agentVersionId ?? null,
        conversationId: input.conversationId ?? null,
        evalId: input.evalId,
        id: input.id ?? nanoid(),
        output: input.output,
        rationale: input.rationale ?? null,
        runGroupId: input.runGroupId ?? null,
        score: input.score,
      };
    });

    yield* runMutation(() => db.insert(agentEvalRun).values(rows));
  });
};
