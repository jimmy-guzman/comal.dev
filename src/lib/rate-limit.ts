import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Effect } from "effect";

import { appRuntime } from "@/db/runtime";
import { env } from "@/env";

const CHAT_AUTHED_LIMIT = 200;
const CHAT_AUTHED_WINDOW = "1 h";
const CHAT_ANON_LIMIT = 40;
const CHAT_ANON_WINDOW = "1 h";
const MUTATION_AUTHED_LIMIT = 60;
const MUTATION_AUTHED_WINDOW = "1 m";
const MUTATION_ANON_LIMIT = 15;
const MUTATION_ANON_WINDOW = "1 m";

const BUDGET_AUTHED_MICRODOLLARS = 5_000_000;
const BUDGET_ANON_MICRODOLLARS = 1_000_000;
const BUDGET_WINDOW_SECONDS = 3600;
const BUDGET_TTL_SECONDS = BUDGET_WINDOW_SECONDS * 2;

const REDIS_TIMEOUT_MS = 1000;

const redis = new Redis({
  token: env.UPSTASH_REDIS_REST_TOKEN,
  url: env.UPSTASH_REDIS_REST_URL,
});

const ephemeralCache = new Map<string, number>();

const createLimiter = (
  prefix: string,
  tokens: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
) => {
  return new Ratelimit({
    ephemeralCache,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix,
    redis,
    timeout: REDIS_TIMEOUT_MS,
  });
};

export const chatLimiter = createLimiter("chat:authed", CHAT_AUTHED_LIMIT, CHAT_AUTHED_WINDOW);

export const chatLimiterAnon = createLimiter("chat:anon", CHAT_ANON_LIMIT, CHAT_ANON_WINDOW);

export const mutationLimiter = createLimiter(
  "action:authed",
  MUTATION_AUTHED_LIMIT,
  MUTATION_AUTHED_WINDOW,
);

export const mutationLimiterAnon = createLimiter(
  "action:anon",
  MUTATION_ANON_LIMIT,
  MUTATION_ANON_WINDOW,
);

interface LimiterPair {
  anon: Ratelimit;
  authed: Ratelimit;
}

interface LimiterUser {
  isAnonymous?: boolean | null | undefined;
}

export const pickLimiter = (pair: LimiterPair, user: LimiterUser): Ratelimit => {
  return user.isAnonymous ? pair.anon : pair.authed;
};

interface CheckLimitResult {
  limit: number;
  remaining: number;
  reset: number;
  success: boolean;
}

export const checkLimit = async (
  limiter: Ratelimit,
  identifier: string,
): Promise<CheckLimitResult> => {
  try {
    const { limit, remaining, reset, success } = await limiter.limit(identifier);

    return { limit, remaining, reset, success };
  } catch (error) {
    void appRuntime.runPromise(
      Effect.logWarning("[rate-limit] Upstash error, failing open", error),
    );

    return { limit: 0, remaining: 0, reset: 0, success: true };
  }
};

const budgetKey = (userId: string): string => {
  const windowId = Math.floor(Date.now() / 1000 / BUDGET_WINDOW_SECONDS);

  return `spend:${userId}:${windowId}`;
};

export const recordSpend = async (userId: string, costMicrodollars: number): Promise<void> => {
  if (costMicrodollars <= 0) return;

  try {
    const key = budgetKey(userId);
    const pipeline = redis.pipeline();

    pipeline.incrby(key, costMicrodollars);
    pipeline.expire(key, BUDGET_TTL_SECONDS);
    await pipeline.exec();
  } catch (error) {
    void appRuntime.runPromise(
      Effect.logWarning("[rate-limit] Failed to record spend, failing open", error),
    );
  }
};

interface BudgetCheckResult {
  budgetMicrodollars: number;
  remainingMicrodollars: number;
  spentMicrodollars: number;
  success: boolean;
}

export const checkBudget = async (
  userId: string,
  isAnonymous: boolean,
): Promise<BudgetCheckResult> => {
  const budget = isAnonymous ? BUDGET_ANON_MICRODOLLARS : BUDGET_AUTHED_MICRODOLLARS;

  try {
    const spent = (await redis.get<number>(budgetKey(userId))) ?? 0;

    return {
      budgetMicrodollars: budget,
      remainingMicrodollars: Math.max(0, budget - spent),
      spentMicrodollars: spent,
      success: spent < budget,
    };
  } catch (error) {
    void appRuntime.runPromise(
      Effect.logWarning("[rate-limit] Budget check failed, failing open", error),
    );

    return {
      budgetMicrodollars: budget,
      remainingMicrodollars: budget,
      spentMicrodollars: 0,
      success: true,
    };
  }
};

export class RateLimitError extends Error {
  readonly limit: number;
  readonly reset: number;

  constructor(options: { limit?: number; reset?: number } = {}) {
    super("Rate limit exceeded. Please try again later.");
    this.name = "RateLimitError";
    this.limit = options.limit ?? 0;
    this.reset = options.reset ?? 0;
  }
}
