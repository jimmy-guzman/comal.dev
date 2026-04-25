import type { AgentConfig } from "./types";

import { createWebSearch } from "./tools/search";
import { tavilyProvider } from "./tools/search/tavily";
import { webFetch } from "./tools/web-fetch";

const webSearch = createWebSearch({ provider: tavilyProvider });

export const assistant = {
  defaultModelId: "openai/gpt-4o-mini",
  description:
    "A helpful general-purpose assistant that can search the web for up-to-date information and fetch web pages.",
  id: "assistant",
  name: "Assistant",
  systemPrompt:
    "You are a helpful AI assistant. You can search the web for up-to-date information and fetch the content of web pages when needed.",
  tools: { webFetch, webSearch },
} satisfies AgentConfig;
