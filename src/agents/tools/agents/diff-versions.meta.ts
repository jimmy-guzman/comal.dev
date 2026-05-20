import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const agentsDiffVersionsMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Compares two version snapshots of an agent and returns a structured field-level diff covering model, system prompt, tools, sub-agents, and evals.",
  group: "agents",
  id: "agents-diff-versions",
  name: "Diff agent versions",
} satisfies ToolMetadata<NoConfigShape>;
