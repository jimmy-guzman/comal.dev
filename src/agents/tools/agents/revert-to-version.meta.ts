import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsRevertToVersionMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Reverts an agent's configuration to a previous version snapshot. Creates a new version reflecting the reverted state.",
  group: "agents",
  id: "agents-revert-to-version",
  name: "Revert agent to version",
} satisfies ToolMetadata<NoConfigShape>;
