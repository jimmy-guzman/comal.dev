import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tracesListForAgentMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Lists recent conversations for an agent with aggregated timing, event count, and cost. Returns summaries only; use traces-get for full per-step detail.",
  group: "traces",
  id: "traces-list-for-agent",
  name: "List agent traces",
} satisfies ToolMetadata<NoConfigShape>;
