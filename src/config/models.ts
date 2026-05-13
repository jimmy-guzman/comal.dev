export type ModelCostLabel = "$" | "$$" | "$$$" | "$$$$";

export const MODEL_GROUPS = [
  {
    label: "OpenAI",
    models: [
      { id: "openai/gpt-5.5", name: "GPT-5.5" },
      { id: "openai/gpt-5.4", name: "GPT-5.4" },
      { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini" },
      { id: "openai/o4-mini", name: "o4 Mini" },
    ],
    provider: "openai",
  },
  {
    label: "Anthropic",
    models: [
      { id: "anthropic/claude-opus-4.7", name: "Claude Opus 4.7" },
      { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
      { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" },
    ],
    provider: "anthropic",
  },
  {
    label: "Google",
    models: [
      { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    ],
    provider: "google",
  },
  {
    label: "xAI",
    models: [
      { id: "x-ai/grok-4.3", name: "Grok 4.3" },
      { id: "x-ai/grok-4.20", name: "Grok 4.20" },
    ],
    provider: "xai",
  },
  {
    label: "DeepSeek",
    models: [
      { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    ],
    provider: "deepseek",
  },
] as const satisfies {
  label: string;
  models: { id: string; name: string }[];
  provider: string;
}[];

type ModelGroup = (typeof MODEL_GROUPS)[number];

export type ModelId = ModelGroup["models"][number]["id"];

export const MODEL_IDS = MODEL_GROUPS.flatMap((group) => {
  return group.models.map((model) => model.id);
});

export const getModelById = (id: string) => {
  for (const group of MODEL_GROUPS) {
    const match = group.models.find((model) => model.id === id);

    if (match) {
      return { id: match.id, name: match.name, provider: group.provider };
    }
  }

  return undefined;
};

/**
 * Static output cost per 1M tokens (USD) for each model.
 * Used to derive the restaurant-style cost label without a DB lookup.
 * Keep in sync with `model_pricing` table via `scripts/seed-pricing.ts`.
 */
const OUTPUT_COST_PER_MILLION: Partial<Record<string, number>> = {
  "anthropic/claude-haiku-4.5": 5,
  "anthropic/claude-opus-4.7": 25,
  "anthropic/claude-sonnet-4.6": 15,
  "deepseek/deepseek-v4-flash": 0.25,
  "deepseek/deepseek-v4-pro": 0.87,
  "google/gemini-2.5-flash": 2.5,
  "google/gemini-2.5-pro": 10,
  "google/gemini-3.1-pro-preview": 12,
  "openai/gpt-5.4": 15,
  "openai/gpt-5.4-mini": 4.5,
  "openai/gpt-5.5": 30,
  "openai/o4-mini": 4.4,
  "x-ai/grok-4.3": 2.5,
  "x-ai/grok-4.20": 2.5,
};

/**
 * Returns a restaurant-style cost label based on output cost per 1M tokens.
 *
 * - `$` under $1/M (DeepSeek V4 Flash, V4 Pro)
 * - `$$` $1-5/M (Flash, Grok, o4 Mini, GPT-5.4 Mini, Haiku)
 * - `$$$` $5-15/M (Gemini Pro, Sonnet, GPT-5.4)
 * - `$$$$` $15+/M (Opus, GPT-5.5)
 */
export const getModelCostLabel = (id: string): ModelCostLabel => {
  const cost = OUTPUT_COST_PER_MILLION[id];

  if (cost === undefined) return "$$";

  if (cost <= 1) return "$";

  if (cost <= 5) return "$$";

  if (cost <= 15) return "$$$";

  return "$$$$";
};
