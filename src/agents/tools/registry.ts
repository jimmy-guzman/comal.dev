import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Tool } from "ai";

import { z } from "zod";

import { getCurrentTime } from "./get-current-time";
import { createReadGitHubFiles } from "./github";
import { rawGitHubProvider } from "./github/raw";
import { createWebSearch } from "./search";
import { tavilyProvider } from "./search/tavily";
import { createWebFetch } from "./web-fetch";

export interface ToolDefinition<TConfig = unknown> {
  build: (config: TConfig) => Tool;
  /** Validates the per-agent config. Output type must match TConfig. */
  configSchema: StandardSchemaV1<unknown, TConfig>;
  defaultConfig: TConfig;
  description: string;
  id: string;
  name: string;
}

const noConfigSchema = z.object({}).strict();

type NoConfig = z.infer<typeof noConfigSchema>;

const approvalConfigSchema = z.object({
  needsApproval: z.boolean().default(false),
});

type ApprovalConfig = z.infer<typeof approvalConfigSchema>;

const getCurrentTimeDef = {
  build: () => getCurrentTime,
  configSchema: noConfigSchema,
  defaultConfig: {},
  description: "Returns the current date and time in the user's timezone.",
  id: "get-current-time",
  name: "Current time",
} satisfies ToolDefinition<NoConfig>;

const webFetchDef = {
  build: (config) => createWebFetch({ needsApproval: config.needsApproval }),
  configSchema: approvalConfigSchema,
  defaultConfig: { needsApproval: true },
  description: "Fetches the contents of a URL and returns it as markdown, text, or HTML.",
  id: "web-fetch",
  name: "Web fetch",
} satisfies ToolDefinition<ApprovalConfig>;

const webSearchDef = {
  build: (config) => {
    return createWebSearch({
      needsApproval: config.needsApproval,
      provider: tavilyProvider,
    });
  },
  configSchema: approvalConfigSchema,
  defaultConfig: { needsApproval: false },
  description: "Searches the web (via Tavily) and returns a list of titles, URLs, and snippets.",
  id: "web-search",
  name: "Web search",
} satisfies ToolDefinition<ApprovalConfig>;

const githubReadDef = {
  build: () => createReadGitHubFiles({ provider: rawGitHubProvider }),
  configSchema: noConfigSchema,
  defaultConfig: {},
  description: "Reads files from public GitHub repositories in batch.",
  id: "github-read",
  name: "GitHub read",
} satisfies ToolDefinition<NoConfig>;

const definitions = [
  getCurrentTimeDef as ToolDefinition,
  webFetchDef as ToolDefinition,
  webSearchDef as ToolDefinition,
  githubReadDef as ToolDefinition,
];

const byId = new Map(definitions.map((def) => [def.id, def]));

export const tools = {
  get: (id: string) => byId.get(id),
  list: () => definitions,
};
