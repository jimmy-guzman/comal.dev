import type { AgentConfig } from "./types";

import { assistant } from "./assistant";

export const AGENTS: AgentConfig[] = [assistant];

export const getAgent = (id: string): AgentConfig | undefined => {
  return AGENTS.find((a) => a.id === id);
};
