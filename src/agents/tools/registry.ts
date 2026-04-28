import type { StandardSchemaV1 } from "@standard-schema/spec";

import { z } from "zod";

interface ToolMetadata<TConfig = unknown> {
  configSchema: StandardSchemaV1<unknown, TConfig>;
  defaultConfig: TConfig;
  description: string;
  id: string;
  name: string;
}

const noConfigSchema = z.object({}).strict();

type NoConfig = z.infer<typeof noConfigSchema>;

const approvalConfigSchema = z.object({
  needsApproval: z.boolean(),
});

type ApprovalConfig = z.infer<typeof approvalConfigSchema>;

const getCurrentTimeMeta = {
  configSchema: noConfigSchema,
  defaultConfig: {},
  description: "Returns the current date and time in the user's timezone.",
  id: "get-current-time",
  name: "Current time",
} satisfies ToolMetadata<NoConfig>;

const webFetchMeta = {
  configSchema: approvalConfigSchema,
  defaultConfig: { needsApproval: true },
  description: "Fetches the contents of a URL and returns it as markdown, text, or HTML.",
  id: "web-fetch",
  name: "Web fetch",
} satisfies ToolMetadata<ApprovalConfig>;

const webSearchMeta = {
  configSchema: approvalConfigSchema,
  defaultConfig: { needsApproval: false },
  description: "Searches the web (via Tavily) and returns a list of titles, URLs, and snippets.",
  id: "web-search",
  name: "Web search",
} satisfies ToolMetadata<ApprovalConfig>;

const githubReadMeta = {
  configSchema: noConfigSchema,
  defaultConfig: {},
  description: "Reads files from public GitHub repositories in batch.",
  id: "github-read",
  name: "GitHub read",
} satisfies ToolMetadata<NoConfig>;

const metadata = [
  getCurrentTimeMeta as ToolMetadata,
  webFetchMeta as ToolMetadata,
  webSearchMeta as ToolMetadata,
  githubReadMeta as ToolMetadata,
];

const byId = new Map(metadata.map((m) => [m.id, m]));

export const tools = {
  get: (id: string) => byId.get(id),
  list: () => metadata,
};
