import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsGetMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Returns full configuration for a specific agent including tools and sub-agents.",
  group: "agents",
  id: "agents-get",
  name: "Get agent details",
} satisfies ToolMetadata<NoConfigShape>;
