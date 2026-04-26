import { APICallError } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";

import { chatErrorCopyFor, classifyChatError } from "./errors";

describe("classifyChatError", () => {
  it("should classify APICallError 401 as auth", () => {
    const error = new APICallError({
      message: "Unauthorized",
      requestBodyValues: {},
      statusCode: 401,
      url: "https://example.test",
    });

    const info = classifyChatError(error);

    expect(info.kind).toBe("auth");
    expect(info.statusCode).toBe(401);
    expect(info.retryable).toBe(false);
    expect(info.suggestModelSwitch).toBe(false);
  });

  it("should classify 429 as rate-limit", () => {
    const error = new APICallError({
      message: "Too Many Requests",
      requestBodyValues: {},
      statusCode: 429,
      url: "https://example.test",
    });

    const info = classifyChatError(error);

    expect(info.kind).toBe("rate-limit");
    expect(info.retryable).toBe(true);
  });

  it("should classify context_length_exceeded message regardless of status", () => {
    const error = new APICallError({
      message: "Bad request",
      requestBodyValues: {},
      responseBody: JSON.stringify({ error: { code: "context_length_exceeded" } }),
      statusCode: 400,
      url: "https://example.test",
    });

    const info = classifyChatError(error);

    expect(info.kind).toBe("context-length");
    expect(info.suggestModelSwitch).toBe(true);
    expect(info.retryable).toBe(false);
  });

  it("should classify 5xx as network", () => {
    const error = new APICallError({
      message: "Bad gateway",
      requestBodyValues: {},
      statusCode: 502,
      url: "https://example.test",
    });

    expect(classifyChatError(error).kind).toBe("network");
  });

  it("should classify fetch failed plain error as network", () => {
    expect(classifyChatError(new Error("fetch failed")).kind).toBe("network");
  });

  it("should classify model_not_found message as model-unavailable", () => {
    const error = new Error("model_not_found: no such model");

    const info = classifyChatError(error);

    expect(info.kind).toBe("model-unavailable");
    expect(info.suggestModelSwitch).toBe(true);
  });

  it("should recognize structural duck-typed APICallError (rehydrated from JSON)", () => {
    const duckTyped = {
      message: "boom",
      name: "AI_APICallError",
      responseBody: "context window exceeded",
      statusCode: 400,
    };

    expect(classifyChatError(duckTyped).kind).toBe("context-length");
  });

  it("should fall back to unknown for unrecognized errors", () => {
    const info = classifyChatError(new Error("totally novel failure"));

    expect(info.kind).toBe("unknown");
    expect(info.retryable).toBe(true);
    expect(info.suggestModelSwitch).toBe(false);
  });
});

describe("chatErrorCopyFor", () => {
  it("should return deterministic copy for a known kind", () => {
    const info = chatErrorCopyFor("rate-limit");

    expect(info.kind).toBe("rate-limit");
    expect(info.retryable).toBe(true);
    expect(info.title.length).toBeGreaterThan(0);
    expect(info.message.length).toBeGreaterThan(0);
  });

  it("should flag suggestModelSwitch for context-length", () => {
    expect(chatErrorCopyFor("context-length").suggestModelSwitch).toBe(true);
  });

  it("should not flag suggestModelSwitch for network", () => {
    expect(chatErrorCopyFor("network").suggestModelSwitch).toBe(false);
  });
});
