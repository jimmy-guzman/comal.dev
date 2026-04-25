import { relations } from "drizzle-orm";
import { index, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

export const chatMessage = pgTable(
  "chat_message",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    modelId: text("model_id"),
    parts: json("parts").notNull(),
    role: text("role").notNull(),
  },
  (table) => {
    return [
      index("chat_message_conversationId_idx").on(table.conversationId),
      index("chat_message_createdAt_idx").on(table.createdAt),
    ];
  },
);

export const conversationRelations = relations(conversation, ({ many, one }) => {
  return {
    messages: many(chatMessage),
    user: one(user, { fields: [conversation.userId], references: [user.id] }),
  };
});

export const chatMessageRelations = relations(chatMessage, ({ one }) => {
  return {
    conversation: one(conversation, {
      fields: [chatMessage.conversationId],
      references: [conversation.id],
    }),
  };
});
