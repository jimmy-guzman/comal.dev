import { relations } from "drizzle-orm";
import { index, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

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
  (table) => [index("agent_eval_agentId_idx").on(table.agentId)],
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
    score: real("score").notNull(),
  },
  (table) => [index("agent_eval_run_evalId_idx").on(table.evalId)],
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
