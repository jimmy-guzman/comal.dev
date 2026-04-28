import { z } from "zod";

import { tools } from "@/agents/tools/registry";
import { MODEL_IDS } from "@/config/models";

const toolEntrySchema = z
  .object({
    config: z.unknown(),
    toolId: z.string(),
  })
  .transform((value, ctx) => {
    const def = tools.get(value.toolId);

    if (!def) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown tool "${value.toolId}".`,
        path: ["toolId"],
      });

      return z.NEVER;
    }

    const validation = def.configSchema["~standard"].validate(value.config);

    if (validation instanceof Promise) {
      ctx.addIssue({
        code: "custom",
        message: `Async tool config validation is not supported.`,
        path: ["config"],
      });

      return z.NEVER;
    }

    if (validation.issues) {
      for (const issue of validation.issues) {
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: ["config", ...(issue.path?.map((p) => (typeof p === "object" ? p.key : p)) ?? [])],
        });
      }

      return z.NEVER;
    }

    return { config: validation.value, toolId: value.toolId };
  });

export const agentInputSchema = z.object({
  defaultModelId: z.enum(MODEL_IDS),
  description: z.string().trim().max(500).optional(),
  name: z.string().trim().min(1).max(100),
  systemPrompt: z.string().trim().min(1).max(20_000),
  tools: z.array(toolEntrySchema).superRefine((items, ctx) => {
    const seen = new Map<string, number>();

    for (const [index, item] of items.entries()) {
      if (seen.has(item.toolId)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate tool selection.",
          path: [index, "toolId"],
        });

        continue;
      }

      seen.set(item.toolId, index);
    }
  }),
});
