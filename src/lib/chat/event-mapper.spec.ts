import type { TextStreamPart, ToolSet } from "ai";

import { APICallError } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";

import type { MapStreamPartContext } from "./event-mapper";

import { createSegmentBuffer, mapStreamPartToEvent } from "./event-mapper";

const MESSAGE_ID = "m1";
const MODEL_ID = "openai/gpt-4o-mini";

const ctxFor = (overrides: Partial<MapStreamPartContext> = {}): MapStreamPartContext => {
  return {
    buffer: createSegmentBuffer(),
    messageId: MESSAGE_ID,
    modelId: MODEL_ID,
    ...overrides,
  };
};

const map = (part: unknown, ctx: MapStreamPartContext = ctxFor()) => {
  return mapStreamPartToEvent(part as TextStreamPart<ToolSet>, ctx);
};

describe("mapStreamPartToEvent", () => {
  it("should emit assistant-turn-start with modelId from context on 'start'", () => {
    const result = map({ type: "start" });

    expect(result).toStrictEqual({
      eventType: "assistant-turn-start",
      messageId: MESSAGE_ID,
      payload: { modelId: MODEL_ID },
      role: "assistant",
    });
  });

  it("should emit step-boundary with empty payload on 'start-step'", () => {
    const result = map({ request: {}, type: "start-step", warnings: [] });

    expect(result).toMatchObject({ eventType: "step-boundary", payload: {} });
  });

  it("should emit assistant-turn-finish with reason and usage on 'finish'", () => {
    const result = map({
      finishReason: "stop",
      totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      type: "finish",
    });

    expect(result).toMatchObject({
      eventType: "assistant-turn-finish",
      payload: {
        finishReason: "stop",
        totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      },
    });
  });

  it("should ignore 'finish-step', 'raw', 'tool-input-start', 'tool-input-delta', 'tool-input-end'", () => {
    expect(map({ finishReason: "stop", type: "finish-step" })).toBeNull();
    expect(map({ rawValue: {}, type: "raw" })).toBeNull();
    expect(map({ id: "x", toolName: "t", type: "tool-input-start" })).toBeNull();
    expect(map({ delta: "{", id: "x", type: "tool-input-delta" })).toBeNull();
    expect(map({ id: "x", type: "tool-input-end" })).toBeNull();
  });

  it("should buffer text-delta and emit text-segment on text-end", () => {
    const ctx = ctxFor();

    expect(map({ id: "t1", type: "text-start" }, ctx)).toBeNull();
    expect(map({ id: "t1", text: "hello ", type: "text-delta" }, ctx)).toBeNull();
    expect(map({ id: "t1", text: "world", type: "text-delta" }, ctx)).toBeNull();

    const end = map({ id: "t1", type: "text-end" }, ctx);

    expect(end).toStrictEqual({
      eventType: "text-segment",
      messageId: MESSAGE_ID,
      payload: { segmentId: "t1", text: "hello world" },
      role: "assistant",
    });

    expect(ctx.buffer.text.has("t1")).toBe(false);
  });

  it("should drop empty text segments on text-end", () => {
    const ctx = ctxFor();

    map({ id: "t1", type: "text-start" }, ctx);

    expect(map({ id: "t1", type: "text-end" }, ctx)).toBeNull();
  });

  it("should buffer reasoning-delta and emit reasoning-segment on reasoning-end", () => {
    const ctx = ctxFor();

    map({ id: "r1", type: "reasoning-start" }, ctx);
    map({ id: "r1", text: "think", type: "reasoning-delta" }, ctx);

    const end = map({ id: "r1", type: "reasoning-end" }, ctx);

    expect(end).toMatchObject({
      eventType: "reasoning-segment",
      payload: { segmentId: "r1", text: "think" },
    });
  });

  it("should emit tool-input-complete on tool-call, preserving dynamic flag", () => {
    const result = map({
      dynamic: true,
      input: { q: "weather" },
      toolCallId: "call-1",
      toolName: "search",
      type: "tool-call",
    });

    expect(result).toStrictEqual({
      eventType: "tool-input-complete",
      messageId: MESSAGE_ID,
      payload: {
        dynamic: true,
        input: { q: "weather" },
        toolCallId: "call-1",
        toolName: "search",
      },
      role: "assistant",
    });
  });

  it("should emit tool-approval-requested with approval id from approvalId field", () => {
    const result = map({
      approvalId: "appr-1",
      toolCall: { input: { cmd: "ls" }, toolCallId: "call-2", toolName: "shell" },
      type: "tool-approval-request",
    });

    expect(result).toMatchObject({
      eventType: "tool-approval-requested",
      payload: {
        approval: { id: "appr-1" },
        input: { cmd: "ls" },
        toolCallId: "call-2",
        toolName: "shell",
      },
    });
  });

  it("should emit tool-output-available on tool-result", () => {
    const result = map({
      output: { ok: true },
      toolCallId: "call-3",
      toolName: "search",
      type: "tool-result",
    });

    expect(result).toMatchObject({
      eventType: "tool-output-available",
      payload: { output: { ok: true }, toolCallId: "call-3", toolName: "search" },
    });
  });

  it("should emit tool-output-denied with reason when present", () => {
    const result = map({
      reason: "user rejected",
      toolCallId: "call-4",
      toolName: "shell",
      type: "tool-output-denied",
    });

    expect(result).toMatchObject({
      eventType: "tool-output-denied",
      payload: { reason: "user rejected", toolCallId: "call-4", toolName: "shell" },
    });
  });

  it("should emit tool-output-error stringifying Error message", () => {
    const result = map({
      error: new Error("network blew up"),
      toolCallId: "call-5",
      toolName: "fetch",
      type: "tool-error",
    });

    expect(result).toMatchObject({
      eventType: "tool-output-error",
      payload: { errorText: "network blew up", toolCallId: "call-5", toolName: "fetch" },
    });
  });

  it("should emit turn-aborted with reason on abort", () => {
    const result = map({ reason: "user-cancelled", type: "abort" });

    expect(result).toMatchObject({
      eventType: "turn-aborted",
      payload: { reason: "user-cancelled" },
    });
  });

  it("should classify error and persist kind+statusCode on error part", () => {
    const apiError = new APICallError({
      message: "This model's maximum context length is 128000 tokens",
      requestBodyValues: {},
      statusCode: 400,
      url: "https://x",
    });

    const result = map({ error: apiError, type: "error" });

    expect(result?.eventType).toBe("turn-error");
    expect(result?.payload).toMatchObject({
      kind: "context-length",
      statusCode: 400,
    });
    expect((result?.payload as { message: string }).message).toContain("maximum context length");
  });

  it("should fall back to 'unknown' kind for unrecognized error shapes", () => {
    const result = map({ error: { foo: "bar" }, type: "error" });

    expect(result?.payload).toMatchObject({ kind: "unknown" });
  });

  it("should stringify non-Error error payloads in turn-error message", () => {
    expect(map({ error: "boom", type: "error" })?.payload).toMatchObject({ message: "boom" });
    expect(map({ error: null, type: "error" })?.payload).toMatchObject({
      message: "Unknown error",
    });
    expect(map({ error: { a: 1 }, type: "error" })?.payload).toMatchObject({ message: '{"a":1}' });
  });

  it("should emit file event only when url and mediaType are strings", () => {
    expect(map({ file: { mediaType: "image/png", url: "https://x" }, type: "file" })).toMatchObject(
      {
        eventType: "file",
        payload: { mediaType: "image/png", url: "https://x" },
      },
    );

    expect(map({ file: { mediaType: "image/png" }, type: "file" })).toBeNull();
    expect(map({ file: { url: "https://x" }, type: "file" })).toBeNull();
  });

  it("should emit source-url with provided id and title, falling back id->url and omitting missing title", () => {
    const withAll = map({
      id: "src-1",
      title: "Docs",
      type: "source",
      url: "https://x",
    });

    expect(withAll).toMatchObject({
      eventType: "source-url",
      payload: { sourceId: "src-1", title: "Docs", url: "https://x" },
    });

    const withoutId = map({ type: "source", url: "https://y" });

    expect(withoutId?.payload).toMatchObject({ sourceId: "https://y", url: "https://y" });
    expect((withoutId?.payload as { title?: string }).title).toBeUndefined();
  });

  it("should ignore source parts without a url", () => {
    expect(map({ id: "src-1", type: "source" })).toBeNull();
  });
});
