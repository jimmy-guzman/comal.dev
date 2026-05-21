import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const costSummaryMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Summarizes an agent's chat spend: total cost, average cost per turn, a per-model breakdown, and the costliest conversations, with an optional date floor.",
  group: "cost",
  id: "cost-summary",
  name: "Summarize agent cost",
} satisfies ToolMetadata<NoConfigShape>;
