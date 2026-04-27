import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const agent = pgTable(
  "agent",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    defaultModelId: text("default_model_id").notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => {
    return [
      index("agent_userId_idx").on(table.userId),
      index("agent_createdAt_idx").on(table.createdAt),
    ];
  },
);

export const agentTool = pgTable(
  "agent_tool",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    config: jsonb("config").notNull().default({}),
    toolId: text("tool_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.agentId, table.toolId] })],
);

export const agentRelations = relations(agent, ({ many, one }) => {
  return {
    tools: many(agentTool),
    user: one(user, { fields: [agent.userId], references: [user.id] }),
  };
});

export const agentToolRelations = relations(agentTool, ({ one }) => {
  return {
    agent: one(agent, { fields: [agentTool.agentId], references: [agent.id] }),
  };
});
