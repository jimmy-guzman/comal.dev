export const OPENROUTER_MODEL_STORAGE_KEY = "comal:openrouter-model";

type OpenRouterModelOption = {
  id: string;
  label: string;
  provider: "openai" | "anthropic" | "google" | "openrouter";
};

export const DEFAULT_OPENROUTER_MODEL = {
  id: "openai/gpt-4o-mini",
  label: "GPT-4o mini",
  provider: "openai",
} as const satisfies OpenRouterModelOption;

export const OPENROUTER_MODELS = [
  DEFAULT_OPENROUTER_MODEL,
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "anthropic",
  },
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    provider: "google",
  },
] as const satisfies readonly OpenRouterModelOption[];

export function labelForOpenRouterModelId(id: string) {
  const found = OPENROUTER_MODELS.find((m) => m.id === id);

  return found?.label ?? id;
}
