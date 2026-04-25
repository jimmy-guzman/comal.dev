"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertConversationAccess, updateConversationModel } from "@/lib/chat";
import { authClient } from "@/lib/safe-action";

export const updateConversationModelAction = authClient
  .inputSchema(
    z.object({
      conversationId: z.string().min(1),
      modelId: z.string().min(1),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const hasAccess = await assertConversationAccess(ctx.auth.user.id, parsedInput.conversationId);

    if (!hasAccess) throw new Error("Forbidden.");

    await updateConversationModel(parsedInput.conversationId, parsedInput.modelId);
    revalidatePath("/", "layout");

    return { modelId: parsedInput.modelId };
  });
