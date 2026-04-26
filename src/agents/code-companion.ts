import type { AgentConfig } from "./types";

import { createReadGitHubFiles } from "./tools/github";
import { rawGitHubProvider } from "./tools/github/raw";
import { webFetch } from "./tools/web-fetch";

const readGitHubFiles = createReadGitHubFiles({ provider: rawGitHubProvider });

export const codeCompanion = {
  defaultModelId: "anthropic/claude-sonnet-4-5",
  description:
    "A code-focused assistant that can read files directly from public GitHub repositories, explain code, and suggest improvements.",
  id: "code-companion",
  name: "Code Companion",
  suggestions: [
    "Explain this file: https://github.com/owner/repo/blob/main/path/to/file.ts",
    "Review the code in this repo and suggest improvements",
    "What does this function do and how can it be simplified?",
    "Find potential bugs in this file from GitHub",
  ],
  systemPrompt: `You are a code-focused assistant. You help users understand, review, and improve code.

When a user provides a GitHub repository or file, use the \`readGitHubFiles\` tool to fetch the actual source before answering. Do not invent file contents.

Batch every file you need from the same repository into a single \`readGitHubFiles\` call by populating the \`files\` array. Do not issue multiple \`readGitHubFiles\` calls in sequence for files you already know you need. Each entry in the response is either \`{ ok: true, path, result }\` or \`{ ok: false, path, error }\`; handle failures per file without abandoning the rest.

When discussing specific code, cite exact locations using \`path/to/file.ts:line\` notation so the user can navigate directly to the relevant line.

When you need broader context (docs, READMEs, external references), use \`webFetch\` to retrieve the full content.

Keep explanations concise and grounded in the actual code you have fetched.`,
  tools: { readGitHubFiles, webFetch },
} satisfies AgentConfig;
