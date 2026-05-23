import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { MODEL_IDS } from "@/config/models";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";

import type { ToolContext } from "../types";

import { tools as toolRegistry } from "../registry";

const normalizeToolId = (input: string) => {
  return input.toLowerCase().trim().replaceAll(/\s+/g, "-");
};

const resolveToolId = (input: string) => {
  const normalized = normalizeToolId(input);
  const meta = toolRegistry.get(normalized);

  return meta ? normalized : undefined;
};

const subAgentSchema = z.object({
  alias: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[\w-]+$/)
    .describe("The alias name for the sub-agent tool (kebab-case, 1-32 chars)."),
  childAgentId: z.string().min(1).describe("The ID of the agent to wire as a sub-agent."),
  descriptionOverride: z
    .string()
    .max(500)
    .optional()
    .describe("Optional description override for the sub-agent tool."),
});

export const buildAgentsUpdate = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Updates an existing agent's configuration. All fields are required (pass existing values for fields you don't want to change). System agents cannot be updated.",
    execute: async ({
      agentId,
      defaultModelId,
      description,
      name,
      subAgents,
      systemPrompt,
      tools,
    }) => {
      if (!(MODEL_IDS as readonly string[]).includes(defaultModelId)) {
        return {
          error: `Invalid model ID "${defaultModelId}". Use agents-list-models to see options.`,
        };
      }

      const resolvedTools: { config: unknown; toolId: string }[] = [];

      for (const t of tools) {
        const resolved = resolveToolId(t.toolId);

        if (!resolved) {
          return {
            error: `Unknown tool "${t.toolId}". Use agents-list-tools to see available tools.`,
          };
        }

        resolvedTools.push({ config: t.config ?? {}, toolId: resolved });
      }

      const resolvedSubAgents = subAgents ?? [];

      if (resolvedSubAgents.length > 0) {
        for (const sub of resolvedSubAgents) {
          if (sub.childAgentId === agentId) {
            return { error: "An agent cannot be its own sub-agent." };
          }
        }

        const childIds = resolvedSubAgents.map((s) => s.childAgentId);

        const ownedExit = await appRuntime.runPromiseExit(
          AgentService.listOwnedAgentIds(context.userId, childIds),
        );

        if (Exit.isFailure(ownedExit)) {
          return { error: "Failed to validate sub-agents." };
        }

        const ownedIds = new Set(ownedExit.value.map((row) => row.id));

        for (const sub of resolvedSubAgents) {
          if (!ownedIds.has(sub.childAgentId)) {
            return { error: `Sub-agent "${sub.childAgentId}" not found or not owned by you.` };
          }
        }
      }

      const exit = await appRuntime.runPromiseExit(
        AgentService.update(agentId, context.userId, (current) => {
          return {
            ...current,
            defaultModelId,
            description,
            name,
            subAgents: resolvedSubAgents,
            systemPrompt,
            tools: resolvedTools,
          };
        }),
      );

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (cause._tag === "Fail") {
          if (cause.error._tag === "AgentCycleError") {
            return {
              error: `Sub-agent selection would create a cycle: ${cause.error.cycle.join(" -> ")}.`,
            };
          }

          if (cause.error._tag === "AgentNotFoundError" || cause.error._tag === "ForbiddenError") {
            return { error: "Agent not found, not owned by you, or a system agent." };
          }
        }

        return { error: "Failed to update agent." };
      }

      revalidateTag(`agents:${context.userId}`, "max");
      revalidateTag(`agent:${agentId}`, "max");

      return { agentId, name };
    },
    inputSchema: z.object({
      agentId: z.string().min(1).describe("The ID of the agent to update."),
      defaultModelId: z.string().describe("The model ID for the agent."),
      description: z.string().max(500).optional().describe("A short description of the agent."),
      name: z.string().min(1).max(100).describe("The name of the agent."),
      subAgents: z.array(subAgentSchema).optional().describe("Sub-agents to wire to this agent."),
      systemPrompt: z
        .string()
        .min(1)
        .max(20_000)
        .describe("The system prompt that defines the agent's behavior."),
      tools: z
        .array(
          z.object({
            config: z
              .record(z.string(), z.unknown())
              .optional()
              .describe("Optional tool-specific config."),
            toolId: z.string().min(1).describe("The tool ID or name."),
          }),
        )
        .describe("Tools to assign to the agent."),
    }),
  });
};
