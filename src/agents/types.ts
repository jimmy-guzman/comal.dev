import type { ToolSet } from "ai";

export interface AgentConfig {
  defaultModelId: string;
  description: string;
  /** Stable slug used as the agentId FK in conversations and as the URL segment. */
  id: string;
  name: string;
  systemPrompt: string;
  tools: ToolSet;
  versionId: null | string;
}
