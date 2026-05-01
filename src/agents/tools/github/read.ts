import { tool } from "ai";
import { z } from "zod";

import { rawGitHubProvider } from "./raw";

const githubRead = tool({
  description:
    "Fetch the raw contents of one or more files from public GitHub repositories in a single call. Pass every file you intend to read up front in the `files` array; do not call this tool repeatedly for files in the same repo. Each file is returned as a discriminated entry: `{ ok: true, path, result }` on success or `{ ok: false, path, error }` on failure, so a single bad path does not fail the batch. File contents are truncated at 100 KB.",
  execute: async ({ files }) => rawGitHubProvider.readFiles(files),
  inputSchema: z.object({
    files: z
      .array(
        z.object({
          owner: z.string().describe("The repository owner (user or organization), e.g. 'vercel'."),
          path: z
            .string()
            .describe("The file path within the repository, e.g. 'packages/next/src/index.ts'."),
          ref: z
            .string()
            .optional()
            .describe("Branch, tag, or commit SHA. Defaults to HEAD if omitted."),
          repo: z.string().describe("The repository name, e.g. 'next.js'."),
        }),
      )
      .min(1)
      .max(20)
      .describe(
        "All files to fetch in this turn. Batch every file you need from the same repo here rather than issuing multiple tool calls.",
      ),
  }),
});

export const buildGithubRead = () => {
  return githubRead;
};
