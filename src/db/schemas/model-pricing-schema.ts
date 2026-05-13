import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const modelPricing = pgTable("model_pricing", {
  currency: text("currency").default("USD").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow().notNull(),
  inputCost: numeric("input_cost").notNull(),
  modelId: text("model_id").primaryKey(),
  outputCost: numeric("output_cost").notNull(),
});
