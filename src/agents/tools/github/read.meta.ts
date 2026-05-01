import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const githubReadMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Reads files from public GitHub repositories in batch.",
  group: "github",
  id: "github-read",
  name: "GitHub read",
} satisfies ToolMetadata<NoConfigShape>;
