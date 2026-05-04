import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent, agentTool } from "@/db/schemas/agent-schema";
import { Database, runQuery } from "@/db/service";

import { tools as toolRegistry } from "../agents/tools/registry";

const SYSTEM_AGENT_NAME = "Comal";
const SYSTEM_AGENT_MODEL = "anthropic/claude-sonnet-4.5";

const SYSTEM_AGENT_TOOLS = [
  "agents-list",
  "agents-get",
  "agents-list-tools",
  "agents-list-models",
  "agents-create",
  "agents-update",
  "agents-delete",
  "web-search",
  "web-fetch",
  "core-now",
];

const SYSTEM_AGENT_PROMPT = `You are Comal, an assistant that helps users build and manage AI agents. You can create new agents, configure their tools and capabilities, wire sub-agents together, and manage existing agents.

When a user asks you to create an agent, gather the necessary information conversationally: what the agent should do, what tools it needs, and what model to use. Use sensible defaults when the user doesn't specify details. Always confirm before creating or modifying an agent.

You have access to the tool registry and can help users understand what tools are available and how they work. You can also browse the web to research topics relevant to building agents.`;

const validateToolIds = () => {
  for (const toolId of SYSTEM_AGENT_TOOLS) {
    if (!toolRegistry.get(toolId)) {
      throw new Error(
        `System agent references unknown tool "${toolId}". Update SYSTEM_AGENT_TOOLS.`,
      );
    }
  }
};

export const getOrCreateSystemAgent = (userId: string) => {
  return Effect.gen(function* () {
    validateToolIds();

    const db = yield* Database;
    const id = nanoid();

    yield* runQuery(() => {
      return db
        .insert(agent)
        .values({
          defaultModelId: SYSTEM_AGENT_MODEL,
          id,
          isSystem: true,
          name: SYSTEM_AGENT_NAME,
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
      return yield* Effect.die("System agent insert and select both failed.");
    }

    if (row.id === id) {
      yield* runQuery(() => {
        return db.insert(agentTool).values(
          SYSTEM_AGENT_TOOLS.map((toolId) => ({
            agentId: id,
            config: {},
            toolId,
          })),
        );
      });
    }

    return row.id;
  });
};
