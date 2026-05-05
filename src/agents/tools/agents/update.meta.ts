import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsUpdateMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Updates an existing agent's configuration.",
  group: "agents",
  id: "agents-update",
  name: "Update agent",
} satisfies ToolMetadata<NoConfigShape>;
