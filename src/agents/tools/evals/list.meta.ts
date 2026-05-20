import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const evalsListMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Lists evals for an agent with their latest run summaries (score, output, rationale, per-trial aggregate).",
  group: "evals",
  id: "evals-list",
  name: "List evals",
} satisfies ToolMetadata<NoConfigShape>;
