import { tools } from "@/agents/tools/registry";

export interface ToolSelection {
  config: Record<string, unknown>;
  enabled: boolean;
  toolId: string;
}

export const initialToolSelections = (
  existing?: { config: unknown; toolId: string }[],
): ToolSelection[] => {
  return tools.list().map((def) => {
    const match = existing?.find((entry) => entry.toolId === def.id);
    const baseConfig = (def.defaultConfig ?? {}) as Record<string, unknown>;
    const incomingConfig =
      match && typeof match.config === "object" && match.config !== null
        ? (match.config as Record<string, unknown>)
        : {};

    return {
      config: { ...baseConfig, ...incomingConfig },
      enabled: Boolean(match),
      toolId: def.id,
    };
  });
};
