import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsListModelsMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Returns the available model groups and model IDs for agent configuration.",
  group: "agents",
  id: "agents-list-models",
  name: "List available models",
} satisfies ToolMetadata<NoConfigShape>;
