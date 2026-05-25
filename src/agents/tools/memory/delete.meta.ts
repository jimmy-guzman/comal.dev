import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const memoryDeleteMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Delete a saved memory by id. Use when the user asks to forget a fact, or to clean up an outdated entry.",
  group: "memory",
  id: "memory-delete",
  name: "Delete memory",
} satisfies ToolMetadata<NoConfigShape>;
