import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const userCredential = pgTable(
  "user_credential",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    providerId: text("provider_id").notNull(),
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
      primaryKey({ columns: [table.userId, table.providerId] }),
      index("user_credential_userId_idx").on(table.userId),
    ];
  },
);

export const userCredentialRelations = relations(userCredential, ({ one }) => {
  return { user: one(user, { fields: [userCredential.userId], references: [user.id] }) };
});
