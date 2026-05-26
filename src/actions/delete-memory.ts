"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { MemoryService } from "@/lib/memory";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  memoryId: z.string().min(1),
});

export const deleteMemoryAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const exit = await appRuntime.runPromiseExit(
      MemoryService.remove(parsedInput.memoryId, ctx.auth.user.id),
    );

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail" && cause.error._tag === "MemoryNotFoundError") {
        throw new Error("Memory not found.");
      }

      throw new Error("Failed to delete memory.");
    }

    updateTag(`memories:${ctx.auth.user.id}`);

    return { id: parsedInput.memoryId };
  });
