import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  server: {
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.url(),
    DATABASE_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1),
    TAVILY_API_KEY: z.string().min(1),
  },
});
