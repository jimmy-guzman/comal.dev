import { relations, sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { agent } from "./agent-schema";

export const agentEval = pgTable(
  "agent_eval",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expected: text("expected").notNull(),
    id: text("id").primaryKey(),
    input: text("input").notNull(),
    name: text("name").notNull(),
    scorer: text("scorer").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => {
    return [
      index("agent_eval_agentId_idx").on(table.agentId),
      check("agent_eval_scorer_valid", sql`${table.scorer} IN ('contains', 'exact')`),
    ];
  },
);

export const agentEvalRun = pgTable(
  "agent_eval_run",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    evalId: text("eval_id")
      .notNull()
      .references(() => agentEval.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    output: text("output").notNull(),
    score: integer("score").notNull(),
  },
  (table) => {
    return [
      index("agent_eval_run_evalId_idx").on(table.evalId),
      check("agent_eval_run_score_valid", sql`${table.score} IN (0, 1)`),
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
    eval: one(agentEval, { fields: [agentEvalRun.evalId], references: [agentEval.id] }),
  };
});
