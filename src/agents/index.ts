import { assistant } from "./assistant";
import type { AgentConfig } from "./types";

export const AGENTS: AgentConfig[] = [assistant];

export const getAgent = (id: string): AgentConfig | undefined => AGENTS.find((a) => a.id === id);
