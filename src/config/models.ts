export const MODEL_GROUPS = [
  {
    label: "OpenAI",
    models: [
      { id: "openai/gpt-5", name: "GPT-5" },
      { id: "openai/gpt-5-mini", name: "GPT-5 mini" },
      { id: "openai/o4-mini", name: "o4 mini" },
    ],
    provider: "openai",
  },
  {
    label: "Anthropic",
    models: [
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
      { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" },
      { id: "anthropic/claude-opus-4.1", name: "Claude Opus 4.1" },
    ],
    provider: "anthropic",
  },
  {
    label: "Google",
    models: [
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    ],
    provider: "google",
  },
  {
    label: "xAI",
    models: [{ id: "x-ai/grok-4", name: "Grok 4" }],
    provider: "xai",
  },
  {
    label: "DeepSeek",
    models: [
      { id: "deepseek/deepseek-v3.2-exp", name: "DeepSeek V3.2" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
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
