import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const memorySaveMeta = {
  access: "write",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Save a durable fact about the user (preferences, identity, context) that should survive across conversations. Use for stable facts, not turn-by-turn details. Saved memories become searchable on the next turn after embedding.",
  group: "memory",
  id: "memory-save",
  name: "Save memory",
} satisfies ToolMetadata<NoConfigShape>;
