"use server";

import { z } from "zod";

import { authClient } from "@/lib/safe-action";
import { updateWorkspaceSpecForUser } from "@/lib/studio";

const updateWorkspaceSpecInputSchema = z.object({
  workspaceId: z.string().min(1),
  content: z.string(),
  expectedRevisionNumber: z.number().int().min(0),
});

export const updateWorkspaceSpecAction = authClient
  .inputSchema(updateWorkspaceSpecInputSchema)
  .action(async ({ parsedInput, ctx }) => {
    const userId = ctx.auth.user.id;

    return updateWorkspaceSpecForUser({
      userId,
      workspaceId: parsedInput.workspaceId,
      content: parsedInput.content,
      expectedRevisionNumber: parsedInput.expectedRevisionNumber,
    });
  });
