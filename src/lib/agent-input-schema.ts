import { z } from "zod";

import { tools } from "@/agents/tools/registry";
import { MODEL_IDS } from "@/config/models";

const aliasSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[\w-]+$/, "Alias may only contain letters, numbers, hyphens, and underscores.");

const subAgentEntrySchema = z.object({
  alias: aliasSchema,
  childAgentId: z.string().min(1),
  descriptionOverride: z.string().trim().max(1024).optional(),
});

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
          path: [
            "config",
            ...(issue.path?.map((path) => {
              return typeof path === "object" ? path.key : path;
            }) ?? []),
          ],
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
  subAgents: z.array(subAgentEntrySchema).superRefine((items, ctx) => {
    const seenAliases = new Set<string>();
    const seenChildren = new Set<string>();

    for (const [index, item] of items.entries()) {
      const alias = item.alias.toLowerCase();

      if (seenAliases.has(alias)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate sub-agent alias.",
          path: [index, "alias"],
        });
      } else {
        seenAliases.add(alias);
      }

      if (seenChildren.has(item.childAgentId)) {
        ctx.addIssue({
          code: "custom",
          message: "Sub-agent already added.",
          path: [index, "childAgentId"],
        });
      } else {
        seenChildren.add(item.childAgentId);
      }
    }
  }),
  systemPrompt: z.string().trim().min(1).max(20_000),
  tools: z.array(toolEntrySchema).superRefine((items, ctx) => {
    const seen = new Set<string>();

    for (const [index, item] of items.entries()) {
      if (seen.has(item.toolId)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate tool selection.",
          path: [index, "toolId"],
        });

        continue;
      }

      seen.add(item.toolId);
    }
  }),
});
