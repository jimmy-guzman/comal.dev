import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const tracesGetMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Returns the projected execution trace for a conversation: timed steps with tool calls, inputs/outputs, errors, and token usage.",
  group: "traces",
  id: "traces-get",
  name: "Get conversation trace",
} satisfies ToolMetadata<NoConfigShape>;
