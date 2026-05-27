import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent, agentTool } from "@/db/schemas/agent-schema";
import { Database, runMutation, runQuery } from "@/db/service";
import { SystemAgentProvisioningError, UnknownToolError } from "@/lib/errors";

import { tools as toolRegistry } from "../agents/tools/registry";

const SYSTEM_AGENT_NAME = "Comal";
const SYSTEM_AGENT_MODEL = "anthropic/claude-haiku-4.5";

const SYSTEM_AGENT_SUGGESTIONS = [
  "help me build my first agent",
  "what tools can I use in an agent?",
  "write an eval for one of my agents",
  "summarize my agent costs",
];

const SYSTEM_AGENT_TOOLS = [
  "agents-list",
  "agents-get",
  "agents-list-tools",
  "agents-list-models",
  "agents-create",
  "agents-update",
  "agents-update-suggestions",
  "agents-delete",
  "agents-list-versions",
  "agents-diff-versions",
  "agents-revert-to-version",
  "evals-create",
  "evals-list",
  "evals-update",
  "evals-delete",
  "evals-run",
  "evals-run-batch",
  "evals-get-history",
  "traces-list-for-agent",
  "traces-get",
  "cost-summary",
  "web-search",
  "web-fetch",
  "core-now",
];

const SYSTEM_AGENT_PROMPT = `You are Comal, an assistant that helps users build, evaluate, and improve AI agents.

You can create and configure agents, wire sub-agents, manage their tools and prompts, and curate the starter suggestions shown in their empty chats. You can author, run, and refine evals against an agent, inspect what an agent did in past conversations through its traces, and browse, diff, or revert configuration versions. Use these together to close the loop: change a prompt or tool selection, run the evals, compare versions, and revert if something regressed.

When a user asks you to create an agent, gather what it should do, what tools it needs, and what model to use conversationally. When the user describes a behavior they want, suggest concrete evals to encode it. When an eval fails, use the output and rationale it returns to decide what to change; eval runs are not traced.

After you create an agent, confirm it succeeded and reference the new agent with an inline markdown link: write the agent's name as a link to /agents/<agentId>, using the agentId returned by the agents-create tool. For example: "I've created [Research Helper](/agents/abc123)."

Always confirm before destructive actions such as deleting or reverting. Use sensible defaults, and research with the web tools when it helps. Do not invent tool ids; list the available tools first if you are unsure.`;

const validateToolIds = Effect.fn("SystemAgentService.validateToolIds")(function* () {
  for (const toolId of SYSTEM_AGENT_TOOLS) {
    if (!toolRegistry.get(toolId)) {
      return yield* Effect.fail(
        new UnknownToolError({
          message: `System agent references unknown tool. Update SYSTEM_AGENT_TOOLS.`,
          toolId,
        }),
      );
    }
  }

  return undefined;
});

export class SystemAgentService extends Effect.Service<SystemAgentService>()("SystemAgentService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const getOrCreate = Effect.fn("SystemAgentService.getOrCreate")(function* (userId: string) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      yield* validateToolIds();

      const id = nanoid();

      yield* runQuery(() => {
        return db
          .insert(agent)
          .values({
            defaultModelId: SYSTEM_AGENT_MODEL,
            id,
            isSystem: true,
            name: SYSTEM_AGENT_NAME,
            suggestions: SYSTEM_AGENT_SUGGESTIONS,
            systemPrompt: SYSTEM_AGENT_PROMPT,
            userId,
          })
          .onConflictDoNothing({ target: [agent.userId], where: eq(agent.isSystem, true) });
      });

      const rows = yield* runQuery(() => {
        return db
          .select({ id: agent.id })
          .from(agent)
          .where(and(eq(agent.userId, userId), eq(agent.isSystem, true)))
          .limit(1);
      });

      const row = rows.at(0);

      if (!row) {
        return yield* Effect.fail(
          new SystemAgentProvisioningError({
            message: "System agent insert and select both failed.",
            userId,
          }),
        );
      }

      yield* runQuery(() => {
        return db
          .insert(agentTool)
          .values(
            SYSTEM_AGENT_TOOLS.map((toolId) => {
              return { agentId: row.id, config: {}, toolId };
            }),
          )
          .onConflictDoNothing();
      });

      return row.id;
    });

    const resync = Effect.fn("SystemAgentService.resync")(function* (userId: string) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      yield* validateToolIds();

      const outcome = yield* runMutation(() => {
        return db.transaction(async (tx) => {
          const rows = await tx
            .select({ id: agent.id })
            .from(agent)
            .where(and(eq(agent.userId, userId), eq(agent.isSystem, true)))
            .limit(1);

          const row = rows.at(0);

          if (!row) return { kind: "missing" } as const;

          await tx
            .update(agent)
            .set({
              defaultModelId: SYSTEM_AGENT_MODEL,
              name: SYSTEM_AGENT_NAME,
              suggestions: SYSTEM_AGENT_SUGGESTIONS,
              systemPrompt: SYSTEM_AGENT_PROMPT,
            })
            .where(eq(agent.id, row.id));

          await tx.delete(agentTool).where(eq(agentTool.agentId, row.id));

          await tx.insert(agentTool).values(
            SYSTEM_AGENT_TOOLS.map((toolId) => {
              return { agentId: row.id, config: {}, toolId };
            }),
          );

          return { agentId: row.id, kind: "ok" } as const;
        });
      });

      if (outcome.kind === "missing") {
        return yield* Effect.fail(
          new SystemAgentProvisioningError({
            message: "System agent has not been provisioned for this user.",
            userId,
          }),
        );
      }

      return outcome.agentId;
    });

    return { getOrCreate, resync };
  }),
}) {}
