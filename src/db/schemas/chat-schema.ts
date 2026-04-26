import { relations } from "drizzle-orm";
import { bigserial, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const conversation = pgTable(
  "conversation",
  {
    agentId: text("agent_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    modelId: text("model_id").notNull(),
    title: text("title").notNull(),
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
      index("conversation_userId_idx").on(table.userId),
      index("conversation_agentId_idx").on(table.agentId),
      index("conversation_createdAt_idx").on(table.createdAt),
    ];
  },
);

export const chatEvent = pgTable(
  "chat_event",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    eventType: text("event_type").notNull(),
    messageId: text("message_id"),
    modelId: text("model_id"),
    payload: jsonb("payload").notNull(),
    role: text("role").notNull(),
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
  },
  (table) => {
    return [
      primaryKey({ columns: [table.conversationId, table.sequence] }),
      index("chat_event_messageId_idx").on(table.messageId),
      index("chat_event_createdAt_idx").on(table.createdAt),
    ];
  },
);

export const conversationRelations = relations(conversation, ({ many, one }) => {
  return {
    events: many(chatEvent),
    user: one(user, { fields: [conversation.userId], references: [user.id] }),
  };
});

export const chatEventRelations = relations(chatEvent, ({ one }) => {
  return {
    conversation: one(conversation, {
      fields: [chatEvent.conversationId],
      references: [conversation.id],
    }),
  };
});
