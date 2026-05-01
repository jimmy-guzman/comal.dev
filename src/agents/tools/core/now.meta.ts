import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const coreNowMeta = {
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description: "Returns the current date and time in the user's timezone.",
  group: "core",
  id: "core-now",
  name: "Current time",
} satisfies ToolMetadata<NoConfigShape>;
