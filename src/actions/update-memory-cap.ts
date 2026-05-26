"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { MemoryService } from "@/lib/memory";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  cap: z.number().int().min(1).max(10_000),
});

export const updateMemoryCapAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const exit = await appRuntime.runPromiseExit(
      MemoryService.updateCap(ctx.auth.user.id, parsedInput.cap),
    );

    if (Exit.isFailure(exit)) {
      throw new Error("Failed to update cap.");
    }

    updateTag(`memories:${ctx.auth.user.id}`);

    return { cap: exit.value.cap };
  });
