import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const evalsRunMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Runs a single eval against the agent's current configuration and records the run with its score.",
  group: "evals",
  id: "evals-run",
  name: "Run eval",
} satisfies ToolMetadata<NoConfigShape>;
