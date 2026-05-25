import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { ToolCallAssertion } from "@/lib/eval-input-schema";

import { user } from "./auth-schema";

export const agent = pgTable(
  "agent",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    defaultModelId: text("default_model_id").notNull(),
    description: text("description"),
    enableMemory: boolean("enable_memory").default(false).notNull(),
    id: text("id").primaryKey(),
    isSystem: boolean("is_system").default(false).notNull(),
    name: text("name").notNull(),
    suggestions: jsonb("suggestions").$type<string[]>().notNull().default([]),
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
      uniqueIndex("agent_user_system_unique")
        .on(table.userId)
        .where(sql`${table.isSystem} = true`),
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

export const agentSubagent = pgTable(
  "agent_subagent",
  {
    alias: text("alias").notNull(),
    childAgentId: text("child_agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    descriptionOverride: text("description_override"),
    parentAgentId: text("parent_agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
  },
  (table) => {
    return [
      primaryKey({ columns: [table.parentAgentId, table.childAgentId] }),
      unique("agent_subagent_parent_alias_unique").on(table.parentAgentId, table.alias),
      index("agent_subagent_child_idx").on(table.childAgentId),
      check("agent_subagent_no_self", sql`${table.parentAgentId} <> ${table.childAgentId}`),
    ];
  },
);

export const agentVersion = pgTable(
  "agent_version",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    evals: jsonb("evals")
      .$type<
        {
          assertion?: ToolCallAssertion;
          expected?: string;
          id?: string;
          input: string;
          name: string;
          scorer: string;
          trials?: number;
        }[]
      >()
      .notNull()
      .default([]),
    id: text("id").primaryKey(),
    modelId: text("model_id").notNull(),
    subAgents: jsonb("sub_agents")
      .$type<
        Pick<typeof agentSubagent.$inferSelect, "alias" | "childAgentId" | "descriptionOverride">[]
      >()
      .notNull()
      .default([]),
    systemPrompt: text("system_prompt").notNull(),
    tools: jsonb("tools")
      .$type<Pick<typeof agentTool.$inferSelect, "config" | "toolId">[]>()
      .notNull()
      .default([]),
  },
  (table) => {
    return [
      index("agent_version_agentId_idx").on(table.agentId),
      index("agent_version_createdAt_idx").on(table.createdAt),
    ];
  },
);

export const agentRelations = relations(agent, ({ many, one }) => {
  return {
    parentLinks: many(agentSubagent, { relationName: "agent_subagent_child" }),
    subAgentLinks: many(agentSubagent, { relationName: "agent_subagent_parent" }),
    tools: many(agentTool),
    user: one(user, { fields: [agent.userId], references: [user.id] }),
    versions: many(agentVersion),
  };
});

export const agentToolRelations = relations(agentTool, ({ one }) => {
  return {
    agent: one(agent, { fields: [agentTool.agentId], references: [agent.id] }),
  };
});

export const agentSubagentRelations = relations(agentSubagent, ({ one }) => {
  return {
    childAgent: one(agent, {
      fields: [agentSubagent.childAgentId],
      references: [agent.id],
      relationName: "agent_subagent_child",
    }),
    parentAgent: one(agent, {
      fields: [agentSubagent.parentAgentId],
      references: [agent.id],
      relationName: "agent_subagent_parent",
    }),
  };
});

export const agentVersionRelations = relations(agentVersion, ({ one }) => {
  return {
    agent: one(agent, { fields: [agentVersion.agentId], references: [agent.id] }),
    createdByUser: one(user, { fields: [agentVersion.createdBy], references: [user.id] }),
  };
});
