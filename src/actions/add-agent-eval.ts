"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import type { Scorer } from "@/lib/eval-input-schema";

import { appRuntime } from "@/db/service";
import { assertAgentOwnership, getAgentForUser, updateAgent } from "@/lib/agents";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { evalEntrySchema } from "@/lib/eval-input-schema";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  agentId: z.string().min(1),
  entry: evalEntrySchema,
});

export const addAgentEvalAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const { agentId, entry } = parsedInput;

    const ownership = await appRuntime.runPromiseExit(
      assertAgentOwnership(agentId, ctx.auth.user.id),
    );

    if (Exit.isFailure(ownership)) {
      const { cause } = ownership;

      if (cause._tag === "Fail") {
        if (cause.error._tag === "ForbiddenError") throw new ForbiddenError();

        if (cause.error._tag === "NotFoundError") throw new NotFoundError({ resource: "agent" });
      }

      throw new Error("Failed to add eval.");
    }

    const current = await appRuntime.runPromise(getAgentForUser(agentId, ctx.auth.user.id));

    if (current.isSystem) throw new ForbiddenError();

    const exit = await appRuntime.runPromiseExit(
      updateAgent(agentId, ctx.auth.user.id, {
        defaultModelId: current.defaultModelId,
        description: current.description ?? undefined,
        evals: [
          ...current.evals.map((e) => {
            return { ...e, expected: e.expected ?? undefined, scorer: e.scorer as Scorer };
          }),
          entry,
        ],
        name: current.name,
        subAgents: current.subAgents.map((s) => {
          return {
            alias: s.alias,
            childAgentId: s.childAgentId,
            descriptionOverride: s.descriptionOverride ?? undefined,
          };
        }),
        systemPrompt: current.systemPrompt,
        tools: current.tools,
      }),
    );

    if (Exit.isFailure(exit)) throw new Error("Failed to add eval.");

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${agentId}`);

    return { agentId };
  });
