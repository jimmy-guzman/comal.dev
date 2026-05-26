import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const memorySearchMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Search saved user memories by semantic similarity. The chat already injects the top matches for the current user message; call this for targeted lookups that the auto-injection didn't surface.",
  group: "memory",
  id: "memory-search",
  name: "Search memory",
} satisfies ToolMetadata<NoConfigShape>;
