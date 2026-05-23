import { tool } from "ai";
import { Effect, Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { MODEL_IDS } from "@/config/models";
import { appRuntime } from "@/db/runtime";
import { detectSubAgentCycle } from "@/lib/agent-graph";
import { AgentService } from "@/lib/agents";

import type { ToolContext } from "../types";

import { tools as toolRegistry } from "../registry";

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const PROPOSED_PARENT_ID = "__proposed__";

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

export const buildAgentsCreate = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Creates a new agent. Resolves tool names to IDs (e.g. 'web search' -> 'web-search'). Defaults to Gemini 2.5 Flash if no model is specified. Supports sub-agent wiring with cycle detection.",
    execute: async ({ defaultModelId, description, name, subAgents, systemPrompt, tools }) => {
      const modelId = defaultModelId ?? DEFAULT_MODEL;

      if (!(MODEL_IDS as readonly string[]).includes(modelId)) {
        return { error: `Invalid model ID "${modelId}". Use agents-list-models to see options.` };
      }

      const resolvedTools: { config: unknown; toolId: string }[] = [];

      if (tools) {
        for (const t of tools) {
          const resolved = resolveToolId(t.toolId);

          if (!resolved) {
            return {
              error: `Unknown tool "${t.toolId}". Use agents-list-tools to see available tools.`,
            };
          }

          resolvedTools.push({ config: t.config ?? {}, toolId: resolved });
        }
      }

      const resolvedSubAgents = subAgents ?? [];

      if (resolvedSubAgents.length > 0) {
        const childIds = resolvedSubAgents.map((s) => s.childAgentId);

        const validationExit = await appRuntime.runPromiseExit(
          Effect.all({
            edges: AgentService.listOwnerSubAgentEdges(context.userId),
            owned: AgentService.listOwnedAgentIds(context.userId, childIds),
          }),
        );

        if (Exit.isFailure(validationExit)) {
          return { error: "Failed to validate sub-agents." };
        }

        const validation = validationExit.value;
        const ownedIds = new Set(validation.owned.map((row) => row.id));

        for (const sub of resolvedSubAgents) {
          if (!ownedIds.has(sub.childAgentId)) {
            return { error: `Sub-agent "${sub.childAgentId}" not found or not owned by you.` };
          }
        }

        const cycle = detectSubAgentCycle(validation.edges, PROPOSED_PARENT_ID, childIds);

        if (cycle) {
          return { error: `Sub-agent selection would create a cycle: ${cycle.join(" -> ")}.` };
        }
      }

      const exit = await appRuntime.runPromiseExit(
        AgentService.create(context.userId, {
          defaultModelId: modelId,
          description,
          evals: [],
          name,
          subAgents: resolvedSubAgents,
          systemPrompt,
          tools: resolvedTools,
        }),
      );

      if (Exit.isFailure(exit)) {
        return { error: "Failed to create agent." };
      }

      revalidateTag(`agents:${context.userId}`, "max");

      return { agentId: exit.value.id, name };
    },
    inputSchema: z.object({
      defaultModelId: z
        .string()
        .optional()
        .describe(
          "The model ID to use (e.g. 'google/gemini-2.5-flash'). Defaults to Gemini 2.5 Flash if not specified.",
        ),
      description: z
        .string()
        .max(500)
        .optional()
        .describe("A short description of what this agent does."),
      name: z.string().min(1).max(100).describe("The name of the agent."),
      subAgents: z.array(subAgentSchema).optional().describe("Sub-agents to wire to this agent."),
      systemPrompt: z
        .string()
        .min(1)
        .max(20_000)
        .describe("The system prompt that defines the agent's behavior and personality."),
      tools: z
        .array(
          z.object({
            config: z
              .record(z.string(), z.unknown())
              .optional()
              .describe("Optional tool-specific config."),
            toolId: z
              .string()
              .min(1)
              .describe(
                "The tool ID or name (e.g. 'web-search' or 'web search'). Will be resolved to the exact registry ID.",
              ),
          }),
        )
        .optional()
        .describe("Tools to assign to the agent."),
    }),
  });
};
