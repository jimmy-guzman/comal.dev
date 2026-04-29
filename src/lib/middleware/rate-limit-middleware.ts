import { createMiddleware } from "next-safe-action";

import {
  checkLimit,
  mutationLimiter,
  mutationLimiterAnon,
  pickLimiter,
  RateLimitError,
} from "@/lib/rate-limit";

export const rateLimitMiddleware = createMiddleware<{
  ctx: { auth: { user: { id: string; isAnonymous?: boolean | null } } };
}>().define(async ({ ctx, next }) => {
  const limiter = pickLimiter(
    { anon: mutationLimiterAnon, authed: mutationLimiter },
    ctx.auth.user,
  );

  const { success } = await checkLimit(limiter, ctx.auth.user.id);

  if (!success) {
    throw new RateLimitError();
  }

  return next();
});
