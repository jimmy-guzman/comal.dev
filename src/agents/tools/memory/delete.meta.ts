import type { ApprovalConfigShape, ToolMetadata } from "../meta";

import { approvalConfigSchema, deepFreeze } from "../meta";

export const memoryDeleteMeta = {
  access: "write",
  configSchema: approvalConfigSchema,
  defaultConfig: deepFreeze({ needsApproval: false }),
  description:
    "Delete a saved memory by id. Use when the user asks to forget a fact, or to clean up an outdated entry.",
  group: "memory",
  id: "memory-delete",
  name: "Delete memory",
} satisfies ToolMetadata<ApprovalConfigShape>;
