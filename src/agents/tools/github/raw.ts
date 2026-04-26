import { TextEncoder } from "node:util";

import { chunk } from "es-toolkit";

import type { GitHubBatchEntry, GitHubFileInput, GitHubFileResult, GitHubProvider } from "./types";

const MAX_BYTES = 100_000;
const CONCURRENCY = 5;

const fetchOne = async (input: GitHubFileInput): Promise<GitHubBatchEntry> => {
  const { owner, path, ref = "HEAD", repo } = input;
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return {
        error: `GitHub fetch failed: ${response.status.toString()} ${response.statusText} — ${url}`,
        ok: false,
        path,
      };
    }

    const sha = response.headers.get("x-git-object-id") ?? "";
    const raw = await response.text();
    const truncated = new TextEncoder().encode(raw).length > MAX_BYTES;
    const content = truncated ? `${raw.slice(0, MAX_BYTES)}\n\n[... truncated ...]` : raw;

    const result: GitHubFileResult = { content, sha, truncated, url };

    return { ok: true, path, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return { error: `GitHub fetch error: ${message} — ${url}`, ok: false, path };
  }
};

export const rawGitHubProvider = {
  readFiles: async (inputs: GitHubFileInput[]): Promise<GitHubBatchEntry[]> => {
    const windows = chunk(inputs, CONCURRENCY);
    const results: GitHubBatchEntry[] = [];

    for (const window of windows) {
      const settled = await Promise.all(window.map((input) => fetchOne(input)));

      results.push(...settled);
    }

    return results;
  },
} satisfies GitHubProvider;
