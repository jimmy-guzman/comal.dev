"use server";

import { Effect, Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { ForbiddenError } from "@/lib/errors";
import { authClient } from "@/lib/safe-action";

export const deleteAgentAction = authClient
  .inputSchema(z.object({ agentId: z.string().min(1) }))
  .action(async ({ ctx, parsedInput }) => {
    const program = Effect.gen(function* () {
      yield* AgentService.assertOwnership(parsedInput.agentId, ctx.auth.user.id);

      const agentRow = yield* AgentService.getForUser(parsedInput.agentId, ctx.auth.user.id);

      if (agentRow.isSystem) {
        yield* Effect.fail(new ForbiddenError({ message: "Cannot delete the system agent." }));

        return;
      }

      yield* AgentService.delete(parsedInput.agentId);
    });

    const exit = await appRuntime.runPromiseExit(program);

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (
        cause._tag === "Fail" &&
        (cause.error._tag === "ForbiddenError" || cause.error._tag === "AgentNotFoundError")
      ) {
        throw cause.error;
      }

      throw new Error("Failed to delete agent.");
    }

    updateTag(`agents:${ctx.auth.user.id}`);
    updateTag(`agent:${parsedInput.agentId}`);

    return { agentId: parsedInput.agentId };
  });
