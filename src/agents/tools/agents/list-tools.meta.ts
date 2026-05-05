import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsListToolsMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Returns the available tool registry with IDs, names, descriptions, and groups.",
  group: "agents",
  id: "agents-list-tools",
  name: "List available tools",
} satisfies ToolMetadata<NoConfigShape>;
