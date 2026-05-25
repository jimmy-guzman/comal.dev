import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, vector } from "drizzle-orm/pg-core";

import { agent } from "./agent-schema";
import { user } from "./auth-schema";

export const memory = pgTable(
  "memory",
  {
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    id: text("id").primaryKey(),
    sourceAgentId: text("source_agent_id").references(() => agent.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => {
    return [
      index("memory_userId_idx").on(table.userId),
      index("memory_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    ];
  },
);

export const userMemorySettings = pgTable("user_memory_settings", {
  cap: integer("cap").default(500).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const memoryRelations = relations(memory, ({ one }) => {
  return {
    sourceAgent: one(agent, { fields: [memory.sourceAgentId], references: [agent.id] }),
    user: one(user, { fields: [memory.userId], references: [user.id] }),
  };
});

export const userMemorySettingsRelations = relations(userMemorySettings, ({ one }) => {
  return {
    user: one(user, { fields: [userMemorySettings.userId], references: [user.id] }),
  };
});
