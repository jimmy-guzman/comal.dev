import { tool } from "ai";
import { z } from "zod";

import type { AgentConfig } from "./types";

// TODO: replace the webSearch stub with a real provider (Tavily, Brave, etc.)
const webSearch = tool({
  description: "Search the web for current information.",
  execute: ({ query }) => {
    void query;

    return {
      note: "Web search is not yet configured. Wire up a provider in src/agents/assistant.ts.",
      results: [],
    };
  },
  inputSchema: z.object({
    query: z.string().describe("The search query."),
  }),
});

export const assistant = {
  defaultModelId: "openai/gpt-4o-mini",
  description:
    "A helpful general-purpose assistant that can search the web for up-to-date information.",
  id: "assistant",
  name: "Assistant",
  systemPrompt:
    "You are a helpful AI assistant. You can search the web for up-to-date information when needed.",
  tools: { webSearch },
} satisfies AgentConfig;
