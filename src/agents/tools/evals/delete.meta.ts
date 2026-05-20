import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const evalsDeleteMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Deletes an eval and snapshots a new agent version reflecting the removal.",
  group: "evals",
  id: "evals-delete",
  name: "Delete eval",
} satisfies ToolMetadata<NoConfigShape>;
