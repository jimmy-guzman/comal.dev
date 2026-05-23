import { betterAuth } from "@next-safe-action/adapter-better-auth";
import { Effect } from "effect";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";

import { appRuntime } from "@/db/runtime";

import { auth } from "./auth";
import { rateLimitMiddleware } from "./middleware/rate-limit-middleware";
import { RateLimitError } from "./rate-limit";

const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    if (error instanceof RateLimitError) return error.message;

    void appRuntime.runPromise(Effect.logError("Server action error", error));

    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export const authClient = actionClient.use(betterAuth(auth)).use(rateLimitMiddleware);
