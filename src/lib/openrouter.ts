import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Effect } from "effect";

import { env } from "@/env";
import { Credentials } from "@/lib/credentials/service";

const platformOpenRouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

export const openrouterForUser = (userId: string) => {
  return Effect.gen(function* () {
    const userKey = yield* Credentials.get(userId, "openrouter");

    if (!userKey || userKey === env.OPENROUTER_API_KEY) {
      return platformOpenRouter;
    }

    return createOpenRouter({ apiKey: userKey });
  });
};

export const platformOpenrouter = platformOpenRouter;
