import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const evalsRunBatchMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Runs every eval for an agent in one batch (up to 3 at a time) and records each run with its score.",
  group: "evals",
  id: "evals-run-batch",
  name: "Run eval suite",
} satisfies ToolMetadata<NoConfigShape>;
