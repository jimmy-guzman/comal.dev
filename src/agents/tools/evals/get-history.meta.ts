import type { NoConfigShape, ToolMetadata } from "../meta";

import { deepFreeze, noConfigSchema } from "../meta";

export const evalsGetHistoryMeta = {
  access: "read",
  configSchema: noConfigSchema,
  defaultConfig: deepFreeze({}),
  description:
    "Lists historical eval runs for an agent, newest first and paginated. Optionally filters to a single eval. Each run carries its score, output, rationale, the agent version it ran against, and the conversation id of its trace.",
  group: "evals",
  id: "evals-get-history",
  name: "Get eval history",
} satisfies ToolMetadata<NoConfigShape>;
