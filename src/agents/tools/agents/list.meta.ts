import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsListMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Lists all agents owned by the current user.",
  group: "agents",
  id: "agents-list",
  name: "List agents",
} satisfies ToolMetadata<NoConfigShape>;
