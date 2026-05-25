"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { MemoryService } from "@/lib/memory";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const addMemoryAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const exit = await appRuntime.runPromiseExit(
      MemoryService.add({
        content: parsedInput.content,
        sourceAgentId: null,
        userId: ctx.auth.user.id,
      }),
    );

    if (Exit.isFailure(exit)) {
      const { cause } = exit;

      if (cause._tag === "Fail" && cause.error._tag === "MemoryCapReachedError") {
        throw new Error(
          `Memory cap reached (${cause.error.current}/${cause.error.cap}). Delete some entries or raise the cap.`,
        );
      }

      throw new Error("Failed to save memory.");
    }

    updateTag(`memories:${ctx.auth.user.id}`);

    return { id: exit.value.id };
  });
