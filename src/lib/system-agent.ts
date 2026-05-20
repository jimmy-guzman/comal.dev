import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent, agentTool } from "@/db/schemas/agent-schema";
import { Database, runQuery } from "@/db/service";

import { tools as toolRegistry } from "../agents/tools/registry";

const SYSTEM_AGENT_NAME = "Comal";
const SYSTEM_AGENT_MODEL = "google/gemini-2.5-flash";

const SYSTEM_AGENT_TOOLS = [
  "agents-list",
  "agents-get",
  "agents-list-tools",
  "agents-list-models",
  "agents-create",
  "agents-update",
  "agents-delete",
  "agents-list-versions",
  "agents-diff-versions",
  "agents-revert-to-version",
  "evals-create",
  "evals-list",
  "evals-update",
  "evals-delete",
  "evals-run",
  "traces-list-for-agent",
  "traces-get",
  "web-search",
  "web-fetch",
  "core-now",
];

const SYSTEM_AGENT_PROMPT = `You are Comal, an assistant that helps users build, evaluate, and improve AI agents.

You can create and configure agents, wire sub-agents, and manage their tools and prompts. You can author, run, and refine evals against an agent, inspect what an agent did in past conversations through its traces, and browse, diff, or revert configuration versions. Use these together to close the loop: change a prompt or tool selection, run the evals, compare versions, and revert if something regressed.

When a user asks you to create an agent, gather what it should do, what tools it needs, and what model to use conversationally. When the user describes a behavior they want, suggest concrete evals to encode it. When an eval fails, use the output and rationale it returns to decide what to change; eval runs are not traced.

Always confirm before destructive actions such as deleting or reverting. Use sensible defaults, and research with the web tools when it helps. Do not invent tool ids; list the available tools first if you are unsure.`;

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
};
