import { and, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent } from "@/db/schemas/agent-schema";
import { agentEval, agentEvalRun } from "@/db/schemas/eval-schema";
import { Database, runMutation, runQuery } from "@/db/service";
import { NotFoundError } from "@/lib/errors";

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
        createdAt: agentEvalRun.createdAt,
        evalId: agentEvalRun.evalId,
        output: agentEvalRun.output,
        rowNum:
          sql<number>`row_number() over (partition by ${agentEvalRun.evalId} order by ${agentEvalRun.createdAt} desc)`.as(
            "row_num",
          ),
        score: agentEvalRun.score,
      })
      .from(agentEvalRun)
      .as("latest_run");

    return yield* runQuery(() => {
      return db
        .select({
          evalId: latestRun.evalId,
          lastRunAt: latestRun.createdAt,
          lastRunOutput: latestRun.output,
          lastRunScore: latestRun.score,
        })
        .from(latestRun)
        .innerJoin(agentEval, eq(agentEval.id, latestRun.evalId))
        .where(and(eq(agentEval.agentId, agentId), eq(latestRun.rowNum, 1)));
    });
  });
};

export const createEvalRun = (
  evalId: string,
  score: number,
  output: string,
  agentVersionId?: null | string,
) => {
  return Effect.gen(function* () {
    const db = yield* Database;

    yield* runMutation(() => {
      return db.insert(agentEvalRun).values({
        agentVersionId: agentVersionId ?? null,
        evalId,
        id: nanoid(),
        output,
        score,
      });
    });
  });
};
