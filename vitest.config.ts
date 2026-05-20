import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "src"),
          },
        },
        test: {
          env: {
            BETTER_AUTH_SECRET: "test-secret",
            DATABASE_URL: "postgres://test:test@localhost:5432/test",
            GITHUB_CLIENT_ID: "test",
            GITHUB_CLIENT_SECRET: "test",
            OPENROUTER_API_KEY: "test",
            TAVILY_API_KEY: "test",
            TMDB_READ_ACCESS_TOKEN: "test",
            UPSTASH_REDIS_REST_TOKEN: "test",
            UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
          },
          environment: "node",
          include: ["src/**/*.spec.ts"],
          name: "node",
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "src"),
          },
        },
        test: {
          environment: "jsdom",
          globals: true,
          include: ["src/**/*.spec.tsx"],
          name: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
