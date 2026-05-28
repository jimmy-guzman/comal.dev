"use server";

import { Exit } from "effect";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { appRuntime } from "@/db/runtime";
import { apiKeyProviderIds } from "@/lib/credentials/providers";
import { Credentials } from "@/lib/credentials/service";
import { authClient } from "@/lib/safe-action";

const inputSchema = z.object({
  apiKey: z.string().trim().min(1).max(500),
  providerId: z.enum(apiKeyProviderIds),
});

export const setCredentialAction = authClient
  .inputSchema(inputSchema)
  .action(async ({ ctx, parsedInput }) => {
    const exit = await appRuntime.runPromiseExit(
      Credentials.set(ctx.auth.user.id, parsedInput.providerId, parsedInput.apiKey),
    );

    if (Exit.isFailure(exit)) {
      throw new Error("Failed to save credential.");
    }

    revalidateTag(`connections:${ctx.auth.user.id}`, "max");

    return { providerId: parsedInput.providerId };
  });
