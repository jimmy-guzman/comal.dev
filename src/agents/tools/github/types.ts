export interface GitHubFileResult {
  content: string;
  sha: string;
  truncated: boolean;
  url: string;
}

export interface GitHubFileInput {
  owner: string;
  path: string;
  ref?: string;
  repo: string;
}

export type GitHubBatchEntry =
  | { error: string; ok: false; path: string }
  | { ok: true; path: string; result: GitHubFileResult };

export interface GitHubProvider {
  readFiles(inputs: GitHubFileInput[]): Promise<GitHubBatchEntry[]>;
}
