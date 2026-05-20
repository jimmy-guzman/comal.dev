import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const evalsCreateMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Creates a new eval for an agent and snapshots a new version reflecting the change.",
  group: "evals",
  id: "evals-create",
  name: "Create eval",
} satisfies ToolMetadata<NoConfigShape>;
