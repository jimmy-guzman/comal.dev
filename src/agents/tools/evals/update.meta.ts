import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const evalsUpdateMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Updates one or more fields on an existing eval and snapshots a new version reflecting the change.",
  group: "evals",
  id: "evals-update",
  name: "Update eval",
} satisfies ToolMetadata<NoConfigShape>;
