"use server";

import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { apiKeyProviderIds } from "@/lib/credentials/providers";
import { Credentials } from "@/lib/credentials/service";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  providerId: z.enum(apiKeyProviderIds),
});

export const clearCredentialAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const exit = await appRuntime.runPromiseExit(
      Credentials.delete(ctx.auth.user.id, parsedInput.providerId),
    );

    if (Exit.isFailure(exit)) {
      throw new Error("Failed to clear credential.");
    }

    revalidateTag(`connections:${ctx.auth.user.id}`, "max");

    return { providerId: parsedInput.providerId };
  });
