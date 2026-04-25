import type { Tool } from "ai";

export interface AgentConfig {
  /** Stable slug used as the agentId FK in conversations and as the URL segment. */
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModelId: string;
  tools: Record<string, Tool>;
}
