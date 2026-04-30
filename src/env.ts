import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const vercelEnv = z.enum(["production", "preview", "development"]).optional();

export const env = createEnv({
  client: {},
  experimental__runtimeEnv: {},
  server: {
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.url().optional(),
    DATABASE_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1),
    TAVILY_API_KEY: z.string().min(1),
    TMDB_READ_ACCESS_TOKEN: z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.url(),
    VERCEL_ENV: vercelEnv,
    VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
    VERCEL_URL: z.string().min(1).optional(),
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});
