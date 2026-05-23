import { and, desc, eq, getTableColumns, inArray, notInArray } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import type { Scorer, ToolCallAssertion } from "@/lib/eval-input-schema";

import { agent, agentSubagent, agentTool, agentVersion } from "@/db/schemas/agent-schema";
import { user } from "@/db/schemas/auth-schema";
import { agentEval } from "@/db/schemas/eval-schema";
import { Database, runMutation, runQuery } from "@/db/service";
import { detectSubAgentCycle } from "@/lib/agent-graph";
import {
  AgentCycleError,
  AgentNotFoundError,
  AgentVersionNotFoundError,
  ForbiddenError,
} from "@/lib/errors";

interface AgentToolInput {
  config: unknown;
  toolId: string;
}

interface AgentSubAgentInput {
  alias: string;
  childAgentId: string;
  descriptionOverride?: string;
}

interface AgentEvalInput {
  assertion?: ToolCallAssertion;
  expected?: string;
  id?: string;
  input: string;
  name: string;
  scorer: Scorer;
  trials: number;
}

interface AgentInput {
  defaultModelId: string;
  description?: string;
  evals: AgentEvalInput[];
  name: string;
  subAgents: AgentSubAgentInput[];
  systemPrompt: string;
  tools: AgentToolInput[];
}

type AgentPatch = (current: AgentInput) => AgentInput;

const buildVersionTools = (tools: AgentToolInput[]) => {
  return tools.map(({ config, toolId }) => ({ config, toolId }));
};

const buildVersionSubAgents = (subAgents: AgentSubAgentInput[]) => {
  return subAgents.map(({ alias, childAgentId, descriptionOverride }) => {
    return { alias, childAgentId, descriptionOverride: descriptionOverride ?? null };
  });
};

const buildVersionEvals = (evals: AgentEvalInput[]) => {
  return evals.map(({ assertion, expected, id, input, name, scorer, trials }) => {
    return {
      ...(assertion === undefined ? {} : { assertion }),
      ...(expected === undefined ? {} : { expected }),
      ...(id === undefined ? {} : { id }),
      input,
      name,
      scorer,
      trials,
    };
  });
};

export type AgentVersionRow = Pick<
  typeof agentVersion.$inferSelect,
  "createdAt" | "createdBy" | "evals" | "id" | "modelId" | "subAgents" | "systemPrompt" | "tools"
> & { creatorName: string };

export class AgentService extends Effect.Service<AgentService>()("AgentService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const listForUser = Effect.fn("AgentService.listForUser")(function* (userId: string) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      return yield* runQuery(() => {
        return db
          .select({
            createdAt: agent.createdAt,
            defaultModelId: agent.defaultModelId,
            description: agent.description,
            id: agent.id,
            isSystem: agent.isSystem,
            name: agent.name,
            updatedAt: agent.updatedAt,
          })
          .from(agent)
          .where(eq(agent.userId, userId))
          .orderBy(desc(agent.updatedAt));
      });
    });

    const getForUser = Effect.fn("AgentService.getForUser")(function* (
      agentId: string,
      userId: string,
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("userId", userId);

      const rows = yield* runQuery(() => {
        return db
          .select()
          .from(agent)
          .where(and(eq(agent.id, agentId), eq(agent.userId, userId)))
          .limit(1);
      });

      const row = rows.at(0);

      if (!row) {
        return yield* Effect.fail(new AgentNotFoundError({ agentId, message: "Agent not found." }));
      }

      const [tools, subAgents, evals] = yield* Effect.all(
        [
          runQuery(() => {
            return db
              .select({ config: agentTool.config, toolId: agentTool.toolId })
              .from(agentTool)
              .where(eq(agentTool.agentId, agentId));
          }),
          runQuery(() => {
            return db
              .select({
                alias: agentSubagent.alias,
                childAgentId: agentSubagent.childAgentId,
                descriptionOverride: agentSubagent.descriptionOverride,
              })
              .from(agentSubagent)
              .where(eq(agentSubagent.parentAgentId, agentId));
          }),
          runQuery(() => {
            return db
              .select({
                assertion: agentEval.assertion,
                expected: agentEval.expected,
                id: agentEval.id,
                input: agentEval.input,
                name: agentEval.name,
                scorer: agentEval.scorer,
                trials: agentEval.trials,
              })
              .from(agentEval)
              .where(eq(agentEval.agentId, agentId));
          }),
        ],
        { concurrency: "unbounded" },
      );

      return { ...row, evals, subAgents, tools };
    });

    const assertOwnership = Effect.fn("AgentService.assertOwnership")(function* (
      agentId: string,
      userId: string,
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("userId", userId);

      const rows = yield* runQuery(() => {
        return db
          .select({ userId: agent.userId })
          .from(agent)
          .where(eq(agent.id, agentId))
          .limit(1);
      });

      const row = rows.at(0);

      if (!row) {
        return yield* Effect.fail(new AgentNotFoundError({ agentId, message: "Agent not found." }));
      }

      if (row.userId !== userId) {
        return yield* Effect.fail(
          new ForbiddenError({ message: "You do not have access to this agent." }),
        );
      }

      return undefined;
    });

    const create = Effect.fn("AgentService.create")(function* (userId: string, input: AgentInput) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      const id = nanoid();

      yield* runMutation(() => {
        return db.transaction(async (tx) => {
          await tx.insert(agent).values({
            defaultModelId: input.defaultModelId,
            description: input.description,
            id,
            name: input.name,
            systemPrompt: input.systemPrompt,
            userId,
          });

          await tx.insert(agentVersion).values({
            agentId: id,
            createdBy: userId,
            evals: buildVersionEvals(input.evals),
            id: nanoid(),
            modelId: input.defaultModelId,
            subAgents: buildVersionSubAgents(input.subAgents),
            systemPrompt: input.systemPrompt,
            tools: buildVersionTools(input.tools),
          });

          if (input.tools.length > 0) {
            await tx.insert(agentTool).values(
              input.tools.map((tool) => {
                return { agentId: id, config: tool.config, toolId: tool.toolId };
              }),
            );
          }

          if (input.subAgents.length > 0) {
            await tx.insert(agentSubagent).values(
              input.subAgents.map((subAgent) => {
                return {
                  alias: subAgent.alias,
                  childAgentId: subAgent.childAgentId,
                  descriptionOverride: subAgent.descriptionOverride,
                  parentAgentId: id,
                };
              }),
            );
          }

          if (input.evals.length > 0) {
            await tx.insert(agentEval).values(
              input.evals.map((evalEntry) => {
                return {
                  agentId: id,
                  assertion: evalEntry.assertion ?? null,
                  expected: evalEntry.expected ?? null,
                  id: nanoid(),
                  input: evalEntry.input,
                  name: evalEntry.name,
                  scorer: evalEntry.scorer,
                  trials: evalEntry.trials,
                };
              }),
            );
          }
        });
      });

      return { id };
    });

    const update = Effect.fn("AgentService.update")(function* (
      agentId: string,
      userId: string,
      patch: AgentPatch,
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("userId", userId);

      const outcome = yield* runMutation(() => {
        return db.transaction(async (tx) => {
          const ownerAgents = await tx
            .select()
            .from(agent)
            .where(eq(agent.userId, userId))
            .orderBy(agent.id)
            .for("update");

          const row = ownerAgents.find((ownerAgent) => ownerAgent.id === agentId);

          if (!row) {
            const existing = await tx
              .select({ id: agent.id })
              .from(agent)
              .where(eq(agent.id, agentId))
              .limit(1);

            return existing.length > 0 ? ("forbidden" as const) : ("not-found" as const);
          }

          if (row.isSystem) return "forbidden" as const;

          const tools = await tx
            .select({ config: agentTool.config, toolId: agentTool.toolId })
            .from(agentTool)
            .where(eq(agentTool.agentId, agentId));

          const subAgents = await tx
            .select({
              alias: agentSubagent.alias,
              childAgentId: agentSubagent.childAgentId,
              descriptionOverride: agentSubagent.descriptionOverride,
            })
            .from(agentSubagent)
            .where(eq(agentSubagent.parentAgentId, agentId));

          const evals = await tx
            .select({
              assertion: agentEval.assertion,
              expected: agentEval.expected,
              id: agentEval.id,
              input: agentEval.input,
              name: agentEval.name,
              scorer: agentEval.scorer,
              trials: agentEval.trials,
            })
            .from(agentEval)
            .where(eq(agentEval.agentId, agentId));

          const input = patch({
            defaultModelId: row.defaultModelId,
            description: row.description ?? undefined,
            evals: evals.map((evalRow) => {
              return {
                ...evalRow,
                assertion: evalRow.assertion ?? undefined,
                expected: evalRow.expected ?? undefined,
                scorer: evalRow.scorer as Scorer,
              };
            }),
            name: row.name,
            subAgents: subAgents.map((subAgent) => {
              return {
                ...subAgent,
                descriptionOverride: subAgent.descriptionOverride ?? undefined,
              };
            }),
            systemPrompt: row.systemPrompt,
            tools,
          });

          const ownerEdges = await tx
            .select({
              childAgentId: agentSubagent.childAgentId,
              parentAgentId: agentSubagent.parentAgentId,
            })
            .from(agentSubagent)
            .innerJoin(agent, eq(agent.id, agentSubagent.parentAgentId))
            .where(eq(agent.userId, userId));

          const cycle = detectSubAgentCycle(
            ownerEdges,
            agentId,
            input.subAgents.map((subAgent) => subAgent.childAgentId),
          );

          if (cycle) return { cycle } as const;

          await tx.insert(agentVersion).values({
            agentId,
            createdBy: userId,
            evals: buildVersionEvals(input.evals),
            id: nanoid(),
            modelId: input.defaultModelId,
            subAgents: buildVersionSubAgents(input.subAgents),
            systemPrompt: input.systemPrompt,
            tools: buildVersionTools(input.tools),
          });

          await tx
            .update(agent)
            .set({
              defaultModelId: input.defaultModelId,
              description: input.description,
              name: input.name,
              systemPrompt: input.systemPrompt,
            })
            .where(eq(agent.id, agentId));

          await tx.delete(agentTool).where(eq(agentTool.agentId, agentId));
          await tx.delete(agentSubagent).where(eq(agentSubagent.parentAgentId, agentId));

          if (input.tools.length > 0) {
            await tx.insert(agentTool).values(
              input.tools.map((tool) => {
                return { agentId, config: tool.config, toolId: tool.toolId };
              }),
            );
          }

          if (input.subAgents.length > 0) {
            await tx.insert(agentSubagent).values(
              input.subAgents.map((subAgent) => {
                return {
                  alias: subAgent.alias,
                  childAgentId: subAgent.childAgentId,
                  descriptionOverride: subAgent.descriptionOverride,
                  parentAgentId: agentId,
                };
              }),
            );
          }

          const keepEvalIds = input.evals
            .map((e) => e.id)
            .filter((id): id is string => id !== undefined);

          await (keepEvalIds.length > 0
            ? tx
                .delete(agentEval)
                .where(and(eq(agentEval.agentId, agentId), notInArray(agentEval.id, keepEvalIds)))
            : tx.delete(agentEval).where(eq(agentEval.agentId, agentId)));

          const existingRows = await tx
            .select({ id: agentEval.id })
            .from(agentEval)
            .where(eq(agentEval.agentId, agentId));
          const existingIds = new Set(existingRows.map((existing) => existing.id));

          for (const evalEntry of input.evals) {
            const existingId =
              evalEntry.id !== undefined && existingIds.has(evalEntry.id)
                ? evalEntry.id
                : undefined;

            await (existingId === undefined
              ? tx.insert(agentEval).values({
                  agentId,
                  assertion: evalEntry.assertion ?? null,
                  expected: evalEntry.expected ?? null,
                  id: evalEntry.id ?? nanoid(),
                  input: evalEntry.input,
                  name: evalEntry.name,
                  scorer: evalEntry.scorer,
                  trials: evalEntry.trials,
                })
              : tx
                  .update(agentEval)
                  .set({
                    assertion: evalEntry.assertion ?? null,
                    expected: evalEntry.expected ?? null,
                    input: evalEntry.input,
                    name: evalEntry.name,
                    scorer: evalEntry.scorer,
                    trials: evalEntry.trials,
                  })
                  .where(and(eq(agentEval.id, existingId), eq(agentEval.agentId, agentId))));
          }

          return "ok" as const;
        });
      });

      if (outcome === "not-found") {
        yield* Effect.fail(new AgentNotFoundError({ agentId, message: "Agent not found." }));
      }

      if (outcome === "forbidden") {
        yield* Effect.fail(
          new ForbiddenError({ message: "You do not have access to this agent." }),
        );
      }

      if (typeof outcome === "object") {
        yield* Effect.fail(
          new AgentCycleError({
            cycle: outcome.cycle,
            message: "Sub-agent change would introduce a cycle.",
          }),
        );
      }
    });

    const remove = Effect.fn("AgentService.delete")(function* (agentId: string) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);

      yield* runQuery(() => db.delete(agent).where(eq(agent.id, agentId)));
    });

    const listOwnerSubAgentEdges = Effect.fn("AgentService.listOwnerSubAgentEdges")(function* (
      userId: string,
    ) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      return yield* runQuery(() => {
        return db
          .select({
            childAgentId: agentSubagent.childAgentId,
            parentAgentId: agentSubagent.parentAgentId,
          })
          .from(agentSubagent)
          .innerJoin(agent, eq(agent.id, agentSubagent.parentAgentId))
          .where(eq(agent.userId, userId));
      });
    });

    const listOwnedAgentIds = Effect.fn("AgentService.listOwnedAgentIds")(function* (
      userId: string,
      agentIds: string[],
    ) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      if (agentIds.length === 0) return [] as { id: string }[];

      return yield* runQuery(() => {
        return db
          .select({ id: agent.id })
          .from(agent)
          .where(and(eq(agent.userId, userId), inArray(agent.id, agentIds)));
      });
    });

    const listVersions = Effect.fn("AgentService.listVersions")(function* (
      agentId: string,
      userId: string,
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("userId", userId);

      return yield* runQuery(() => {
        return db
          .select({
            createdAt: agentVersion.createdAt,
            createdBy: agentVersion.createdBy,
            creatorName: user.name,
            evals: agentVersion.evals,
            id: agentVersion.id,
            modelId: agentVersion.modelId,
            subAgents: agentVersion.subAgents,
            systemPrompt: agentVersion.systemPrompt,
            tools: agentVersion.tools,
          })
          .from(agentVersion)
          .innerJoin(user, eq(user.id, agentVersion.createdBy))
          .innerJoin(agent, eq(agent.id, agentVersion.agentId))
          .where(and(eq(agentVersion.agentId, agentId), eq(agent.userId, userId)))
          .orderBy(desc(agentVersion.createdAt));
      });
    });

    const getVersion = Effect.fn("AgentService.getVersion")(function* (
      versionId: string,
      agentId: string,
      ownerId: string,
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("versionId", versionId);

      const rows = yield* runQuery(() => {
        return db
          .select(getTableColumns(agentVersion))
          .from(agentVersion)
          .innerJoin(agent, eq(agent.id, agentVersion.agentId))
          .where(
            and(
              eq(agentVersion.id, versionId),
              eq(agentVersion.agentId, agentId),
              eq(agent.userId, ownerId),
            ),
          )
          .limit(1);
      });

      const row = rows.at(0);

      if (!row) {
        return yield* Effect.fail(
          new AgentVersionNotFoundError({
            agentId,
            message: "Agent version not found.",
            versionId,
          }),
        );
      }

      return row;
    });

    return {
      assertOwnership,
      create,
      delete: remove,
      getForUser,
      getVersion,
      listForUser,
      listOwnedAgentIds,
      listOwnerSubAgentEdges,
      listVersions,
      update,
    };
  }),
}) {}
