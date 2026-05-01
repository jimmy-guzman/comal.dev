import { betterAuth } from "@next-safe-action/adapter-better-auth";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";

import { auth } from "./auth";
import { rateLimitMiddleware } from "./middleware/rate-limit-middleware";
import { RateLimitError } from "./rate-limit";

const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    return error instanceof RateLimitError ? error.message : DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export const authClient = actionClient.use(betterAuth(auth)).use(rateLimitMiddleware);
