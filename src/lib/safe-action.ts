import { betterAuth } from "@next-safe-action/adapter-better-auth";
import { createSafeActionClient } from "next-safe-action";

import { auth } from "./auth";
import { rateLimitMiddleware } from "./middleware/rate-limit-middleware";

const actionClient = createSafeActionClient();

export const authClient = actionClient
  .use(betterAuth(auth))
  .use(rateLimitMiddleware);
