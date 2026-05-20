import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsListVersionsMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Lists agent configuration version snapshots (newest first) with model, prompt, tools, sub-agents, and evals captured at each point.",
  group: "agents",
  id: "agents-list-versions",
  name: "List agent versions",
} satisfies ToolMetadata<NoConfigShape>;
