import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { MemoryService } from "@/lib/memory";

import type { ToolContext } from "../types";

export const buildMemoryDelete = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Delete a saved memory by id. Use when the user asks to forget a fact or to clean up an outdated entry.",
    execute: async ({ memoryId }) => {
      const exit = await appRuntime.runPromiseExit(MemoryService.remove(memoryId, context.userId));

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (cause._tag === "Fail" && cause.error._tag === "MemoryNotFoundError") {
          return { error: "Memory not found or not owned by you." };
        }

        return { error: "Failed to delete memory." };
      }

      revalidateTag(`memories:${context.userId}`, "max");

      return { id: memoryId };
    },
    inputSchema: z.object({
      memoryId: z.string().trim().min(1).describe("The id of the memory to delete."),
    }),
  });
};
