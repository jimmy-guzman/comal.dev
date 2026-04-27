import type { AgentConfig } from "./types";

import { assistant } from "./assistant";
import { codeCompanion } from "./code-companion";

export const AGENTS: AgentConfig[] = [assistant, codeCompanion];

export const getAgent = (id: string): AgentConfig | undefined => {
  return AGENTS.find((a) => a.id === id);
};
