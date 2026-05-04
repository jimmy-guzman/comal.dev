"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/service";
import { assertAgentOwnership, deleteAgent, getAgentForUser } from "@/lib/agents";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

export const deleteAgentAction = authClient
  .inputSchema(z.object({ agentId: z.string().min(1) }))
  .action(async ({ ctx, parsedInput }) => {
    const program = Effect.gen(function* () {
      yield* assertAgentOwnership(parsedInput.agentId, ctx.auth.user.id);

      const agentRow = yield* getAgentForUser(parsedInput.agentId, ctx.auth.user.id);

      if (agentRow.isSystem) {
        yield* Effect.fail(new ForbiddenError());

        return;
      }

      yield* deleteAgent(parsedInput.agentId);
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail") {
        if (cause.error._tag === "ForbiddenError") throw new ForbiddenError();

        if (cause.error._tag === "NotFoundError") {
          throw new NotFoundError({ resource: "agent" });
        }
      }

      throw new Error("Failed to delete agent.");
    }

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${parsedInput.agentId}`);

    return { agentId: parsedInput.agentId };
  });
