import type { ApprovalConfigShape, ToolMetadata } from "../meta";

import { approvalConfigSchema, deepFreeze } from "../meta";

export const webSearchMeta = {
  configSchema: approvalConfigSchema,
  defaultConfig: deepFreeze({ needsApproval: false }),
  description: "Searches the web (via Tavily) and returns a list of titles, URLs, and snippets.",
  group: "web",
  id: "web-search",
  name: "Web search",
} satisfies ToolMetadata<ApprovalConfigShape>;
