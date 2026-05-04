import { z } from "zod";

export const groups = {
  core: { id: "core", label: "Core" },
  github: { id: "github", label: "GitHub" },
  tmdb: { id: "tmdb", label: "TMDB" },
  web: { id: "web", label: "Web" },
} as const satisfies Record<string, { id: string; label: string }>;

type ToolGroupId = keyof typeof groups;

export interface ToolMetadata<TConfig extends z.ZodRawShape = z.ZodRawShape> {
  access: "read" | "read-write" | "write";
  configSchema: z.ZodObject<TConfig>;
  defaultConfig: z.infer<z.ZodObject<TConfig>>;
  description: string;
  group: ToolGroupId;
  id: string;
  name: string;
}

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }

  return value;
};

export const noConfigSchema = z.object({}).strict();

export type NoConfigShape = (typeof noConfigSchema)["shape"];

export const approvalConfigSchema = z.object({
  needsApproval: z
    .boolean()
    .describe("Ask before each call. Recommended for tools that fetch external content."),
});

export type ApprovalConfigShape = (typeof approvalConfigSchema)["shape"];
