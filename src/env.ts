import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const vercelEnv = z.enum(["production", "preview", "development"]).optional();

export const env = createEnv({
  client: {
    NEXT_PUBLIC_APP_URL: z.url().optional(),
    NEXT_PUBLIC_VERCEL_ENV: vercelEnv,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
    NEXT_PUBLIC_VERCEL_URL: z.string().min(1).optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  },
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
});
