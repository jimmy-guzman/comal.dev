import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization, user } from "@/db/schemas/auth-schema";

export const workspaceChatRole = pgEnum("workspace_chat_role", ["user", "assistant", "system"]);
export const workspaceSpecRevisionSource = pgEnum("workspace_spec_revision_source", [
  "chat",
  "editor",
  "import",
  "system",
]);

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled API"),
    slug: text("slug"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => [
    index("workspace_organizationId_idx").on(table.organizationId),
    uniqueIndex("workspace_organizationId_slug_uidx").on(table.organizationId, table.slug),
  ],
);

export const workspaceSpec = pgTable("workspace_spec", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspace.id, { onDelete: "cascade" }),
  format: text("format").notNull().default("openapi-yaml"),
  content: text("content").notNull(),
  revisionNumber: integer("revision_number").notNull().default(0),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const workspaceSpecRevision = pgTable(
  "workspace_spec_revision",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    content: text("content").notNull(),
    changeSource: workspaceSpecRevisionSource("change_source").notNull(),
    messageId: text("message_id"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_spec_revision_workspaceId_revisionNumber_uidx").on(
      table.workspaceId,
      table.revisionNumber,
    ),
    index("workspace_spec_revision_workspaceId_createdAt_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const workspaceChatMessage = pgTable(
  "workspace_chat_message",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    role: workspaceChatRole("role").notNull(),
    partsJson: jsonb("parts_json").notNull(),
    modelId: text("model_id"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("workspace_chat_message_workspaceId_createdAt_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
  organization: one(organization, {
    fields: [workspace.organizationId],
    references: [organization.id],
  }),
  createdByUser: one(user, {
    fields: [workspace.createdByUserId],
    references: [user.id],
  }),
  spec: one(workspaceSpec, {
    fields: [workspace.id],
    references: [workspaceSpec.workspaceId],
  }),
  specRevisions: many(workspaceSpecRevision),
  chatMessages: many(workspaceChatMessage),
}));

export const workspaceSpecRelations = relations(workspaceSpec, ({ one }) => ({
  workspace: one(workspace, {
    fields: [workspaceSpec.workspaceId],
    references: [workspace.id],
  }),
  updatedByUser: one(user, {
    fields: [workspaceSpec.updatedByUserId],
    references: [user.id],
  }),
}));

export const workspaceSpecRevisionRelations = relations(workspaceSpecRevision, ({ one }) => ({
  workspace: one(workspace, {
    fields: [workspaceSpecRevision.workspaceId],
    references: [workspace.id],
  }),
  createdByUser: one(user, {
    fields: [workspaceSpecRevision.createdByUserId],
    references: [user.id],
  }),
}));

export const workspaceChatMessageRelations = relations(workspaceChatMessage, ({ one }) => ({
  workspace: one(workspace, {
    fields: [workspaceChatMessage.workspaceId],
    references: [workspace.id],
  }),
  createdByUser: one(user, {
    fields: [workspaceChatMessage.createdByUserId],
    references: [user.id],
  }),
}));
