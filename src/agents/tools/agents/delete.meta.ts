import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsDeleteMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Deletes an agent owned by the current user.",
  group: "agents",
  id: "agents-delete",
  name: "Delete agent",
} satisfies ToolMetadata<NoConfigShape>;
