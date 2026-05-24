import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsUpdateSuggestionsMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Replaces an agent's starter suggestions shown in empty chats.",
  group: "agents",
  id: "agents-update-suggestions",
  name: "Update agent suggestions",
} satisfies ToolMetadata<NoConfigShape>;
