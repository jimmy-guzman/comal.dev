import { relations, sql } from "drizzle-orm";
import { check, index, integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

import { agent, agentVersion } from "./agent-schema";

export const agentEval = pgTable(
  "agent_eval",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expected: text("expected"),
    id: text("id").primaryKey(),
    input: text("input").notNull(),
    name: text("name").notNull(),
    scorer: text("scorer").notNull(),
    trials: integer("trials").default(1).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => {
    return [
      index("agent_eval_agentId_idx").on(table.agentId),
      check(
        "agent_eval_scorer_valid",
        sql`${table.scorer} IN ('contains', 'exact', 'levenshtein', 'llm-judge')`,
      ),
      check("agent_eval_trials_valid", sql`${table.trials} >= 1 AND ${table.trials} <= 10`),
    ];
  },
);

export const agentEvalRun = pgTable(
  "agent_eval_run",
  {
    agentVersionId: text("agent_version_id").references(() => agentVersion.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    evalId: text("eval_id")
      .notNull()
      .references(() => agentEval.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    output: text("output").notNull(),
    rationale: text("rationale"),
    runGroupId: text("run_group_id"),
    score: real("score").notNull(),
  },
  (table) => {
    return [
      index("agent_eval_run_evalId_idx").on(table.evalId),
      index("agent_eval_run_runGroupId_idx").on(table.runGroupId),
      check("agent_eval_run_score_valid", sql`${table.score} >= 0 AND ${table.score} <= 1`),
    ];
  },
);

export const agentEvalRelations = relations(agentEval, ({ many, one }) => {
  return {
    agent: one(agent, { fields: [agentEval.agentId], references: [agent.id] }),
    runs: many(agentEvalRun),
  };
});

export const agentEvalRunRelations = relations(agentEvalRun, ({ one }) => {
  return {
    agentVersion: one(agentVersion, {
      fields: [agentEvalRun.agentVersionId],
      references: [agentVersion.id],
    }),
    eval: one(agentEval, { fields: [agentEvalRun.evalId], references: [agentEval.id] }),
  };
});
