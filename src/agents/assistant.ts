import { tool } from "ai";
import { z } from "zod";

import type { AgentConfig } from "./types";

// TODO: replace the webSearch stub with a real provider (Tavily, Brave, etc.)
const webSearch = tool({
  description: "Search the web for current information.",
  inputSchema: z.object({
    query: z.string().describe("The search query."),
  }),
  execute: async ({ query }) => {
    void query;
    return {
      results: [],
      note: "Web search is not yet configured. Wire up a provider in src/agents/assistant.ts.",
    };
  },
});

export const assistant = {
  id: "assistant",
  name: "Assistant",
  description:
    "A helpful general-purpose assistant that can search the web for up-to-date information.",
  systemPrompt:
    "You are a helpful AI assistant. You can search the web for up-to-date information when needed.",
  defaultModelId: "openai/gpt-4o-mini",
  tools: { webSearch },
} satisfies AgentConfig;
