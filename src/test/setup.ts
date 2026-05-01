import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./msw-server";

/**
 * `@/env` uses `@t3-oss/env-nextjs`, which throws when server-only vars are
 * read from a context where `typeof window !== "undefined"`. jsdom defines
 * window, so any module that imports `@/env` (db client, server actions)
 * crashes at import time. Stub it with the same shape; the test never
 * touches a real DB or external service.
 */
vi.mock("@/env", () => {
  return {
    env: {
      BETTER_AUTH_SECRET: "test-secret",
      BETTER_AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      GITHUB_CLIENT_ID: "test",
      GITHUB_CLIENT_SECRET: "test",
      OPENROUTER_API_KEY: "test",
      TAVILY_API_KEY: "test",
      TMDB_READ_ACCESS_TOKEN: "test",
      UPSTASH_REDIS_REST_TOKEN: "test",
      UPSTASH_REDIS_REST_URL: "http://localhost",
    },
  };
});

class ResizeObserverStub {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

globalThis.ResizeObserver = ResizeObserverStub;

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
