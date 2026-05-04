import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsCreateMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Creates a new agent with the specified configuration.",
  group: "agents",
  id: "agents-create",
  name: "Create agent",
} satisfies ToolMetadata<NoConfigShape>;
