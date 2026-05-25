import { tool } from "ai";
import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { MemoryService } from "@/lib/memory";

import type { ToolContext } from "../types";

export const buildMemorySave = (_config: unknown, context: ToolContext) => {
  return tool({
    description:
      "Save a durable fact about the user (preferences, identity, context) that should survive across conversations. Saved memories become searchable on the next turn after embedding.",
    execute: async ({ content }) => {
      const exit = await appRuntime.runPromiseExit(
        MemoryService.add({
          content,
          sourceAgentId: context.agentId,
          userId: context.userId,
        }),
      );

      if (Exit.isFailure(exit)) {
        const { cause } = exit;

        if (cause._tag === "Fail" && cause.error._tag === "MemoryCapReachedError") {
          return {
            error: `Memory cap reached (${cause.error.current}/${cause.error.cap}). Ask the user to delete some entries or raise the cap.`,
          };
        }

        return { error: "Failed to save memory." };
      }

      revalidateTag(`memories:${context.userId}`, "max");

      return { id: exit.value.id };
    },
    inputSchema: z.object({
      content: z
        .string()
        .trim()
        .min(1)
        .max(2000)
        .describe(
          'The fact to remember. Write it as a self-contained statement, e.g. "User\'s favorite editor is vim".',
        ),
    }),
  });
};
