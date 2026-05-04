import type { ApprovalConfigShape, ToolMetadata } from "../meta";

import { approvalConfigSchema, deepFreeze } from "../meta";

export const webFetchMeta = {
  access: "read",
  configSchema: approvalConfigSchema,
  defaultConfig: deepFreeze({ needsApproval: false }),
  description: "Fetches the contents of a URL and returns it as markdown, text, or HTML.",
  group: "web",
  id: "web-fetch",
  name: "Web fetch",
} satisfies ToolMetadata<ApprovalConfigShape>;
