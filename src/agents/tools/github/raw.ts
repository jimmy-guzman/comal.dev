import { TextDecoder, TextEncoder } from "node:util";

import { chunk } from "es-toolkit";

import type { GitHubBatchEntry, GitHubFileInput, GitHubFileResult, GitHubProvider } from "./types";

const MAX_BYTES = 100_000;
const CONCURRENCY = 5;

const encodePath = (path: string) => {
  return path.split("/").map(encodeURIComponent).join("/");
};

const TRUNCATION_MARKER = "\n\n[... truncated ...]";

const truncateToBytes = (raw: string, maxBytes: number) => {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(raw);

  if (encoded.length <= maxBytes) {
    return { content: raw, truncated: false };
  }

  const markerBytes = encoder.encode(TRUNCATION_MARKER).length;
  const headBudget = Math.max(0, maxBytes - markerBytes);
  const head = new TextDecoder("utf-8", { fatal: false }).decode(encoded.subarray(0, headBudget));

  return { content: `${head}${TRUNCATION_MARKER}`, truncated: true };
};

const fetchOne = async (input: GitHubFileInput): Promise<GitHubBatchEntry> => {
  const { owner, path, ref = "HEAD", repo } = input;
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${encodePath(path)}`;

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
    const { content, truncated } = truncateToBytes(raw, MAX_BYTES);

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
