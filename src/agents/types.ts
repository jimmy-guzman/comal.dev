import type { Tool } from "ai";

export interface AgentConfig {
  defaultModelId: string;
  description: string;
  /** Stable slug used as the agentId FK in conversations and as the URL segment. */
  id: string;
  name: string;
  /** Optional starter prompts shown in an empty chat. Each entry should be a short prompt string. */
  suggestions?: string[];
  systemPrompt: string;
  tools: Record<string, Tool>;
}
