import type { TextStreamPart, ToolSet } from "ai";

import { APICallError } from "@ai-sdk/provider";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MapStreamPartContext } from "./event-mapper";

import { createSegmentBuffer, mapStreamPartToEvent } from "./event-mapper";

const MESSAGE_ID = "m1";
const MODEL_ID = "openai/gpt-4o-mini";

const ctxFor = (overrides: Partial<MapStreamPartContext> = {}): MapStreamPartContext => {
  return {
    buffer: createSegmentBuffer(),
    messageId: MESSAGE_ID,
    modelId: MODEL_ID,
    toolStartTimes: new Map(),
    ...overrides,
  };
};

const map = (part: unknown, ctx: MapStreamPartContext = ctxFor()) => {
  return mapStreamPartToEvent(part as TextStreamPart<ToolSet>, ctx);
};

describe("mapStreamPartToEvent", () => {
  it("should emit assistant-turn-start with modelId from context on 'start'", () => {
    const result = map({ type: "start" });

    expect(result).toMatchObject({
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

    expect(result).toMatchObject({
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

  it("should include preliminary: true in payload when tool-result is preliminary", () => {
    const result = map({
      output: { status: "running" },
      preliminary: true,
      toolCallId: "call-sub",
      toolName: "my-sub-agent",
      type: "tool-result",
    });

    expect(result).toMatchObject({
      eventType: "tool-output-available",
      payload: { preliminary: true, toolCallId: "call-sub" },
    });
  });

  it("should omit preliminary from payload when tool-result is not preliminary", () => {
    const result = map({
      output: { status: "done" },
      toolCallId: "call-sub",
      toolName: "my-sub-agent",
      type: "tool-result",
    });

    expect(result).toMatchObject({
      eventType: "tool-output-available",
      payload: { toolCallId: "call-sub" },
    });

    const payload = result?.payload as Record<string, unknown>;

    expect(payload.preliminary).toBeUndefined();
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

describe("mapStreamPartToEvent - timing", () => {
  let baseTime: Date;

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    baseTime = new Date("2024-01-01T00:00:00.000Z");
    vi.setSystemTime(baseTime);
  });

  it("should set startedAt on assistant-turn-start and store it in ctx.toolStartTimes under the turn key", () => {
    const ctx = ctxFor();

    const result = map({ type: "start" }, ctx);

    expect(result?.startedAt).toEqual(baseTime);
    expect(ctx.toolStartTimes.size).toBe(1);
    expect(result?.endedAt).toBeUndefined();
  });

  it("should set startedAt on step-boundary with no endedAt", () => {
    const result = map({ request: {}, type: "start-step", warnings: [] });

    expect(result?.startedAt).toEqual(baseTime);
    expect(result?.endedAt).toBeUndefined();
  });

  it("should set startedAt on tool-input-complete and record it in ctx.toolStartTimes", () => {
    const ctx = ctxFor();

    const result = map(
      { dynamic: false, input: {}, toolCallId: "call-t", toolName: "t", type: "tool-call" },
      ctx,
    );

    expect(result?.startedAt).toEqual(baseTime);
    expect(ctx.toolStartTimes.get("call-t")).toBe(result?.startedAt);
    expect(result?.endedAt).toBeUndefined();
  });

  it("should carry turn startedAt and set endedAt on assistant-turn-finish", () => {
    const ctx = ctxFor();

    const startResult = map({ type: "start" }, ctx);
    const turnStart = startResult?.startedAt;

    const closeTime = new Date(baseTime.getTime() + 1);

    vi.setSystemTime(closeTime);

    const result = map(
      {
        finishReason: "stop",
        totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        type: "finish",
      },
      ctx,
    );

    expect(result?.startedAt).toBe(turnStart);
    expect(result?.startedAt).toEqual(baseTime);
    expect(result?.endedAt).toEqual(closeTime);
  });

  it("should carry tool startedAt and set endedAt on tool-output-available, then remove from map", () => {
    const ctx = ctxFor();

    map({ dynamic: false, input: {}, toolCallId: "call-u", toolName: "u", type: "tool-call" }, ctx);

    const toolStart = ctx.toolStartTimes.get("call-u");
    const closeTime = new Date(baseTime.getTime() + 1);

    vi.setSystemTime(closeTime);

    const result = map(
      { output: { ok: true }, toolCallId: "call-u", toolName: "u", type: "tool-result" },
      ctx,
    );

    expect(result?.startedAt).toBe(toolStart);
    expect(result?.startedAt).toEqual(baseTime);
    expect(result?.endedAt).toEqual(closeTime);
    expect(ctx.toolStartTimes.has("call-u")).toBe(false);
  });

  it("should carry tool startedAt and set endedAt on tool-output-error, then remove from map", () => {
    const ctx = ctxFor();

    map({ dynamic: false, input: {}, toolCallId: "call-e", toolName: "e", type: "tool-call" }, ctx);

    const toolStart = ctx.toolStartTimes.get("call-e");
    const closeTime = new Date(baseTime.getTime() + 1);

    vi.setSystemTime(closeTime);

    const result = map(
      { error: new Error("boom"), toolCallId: "call-e", toolName: "e", type: "tool-error" },
      ctx,
    );

    expect(result?.startedAt).toBe(toolStart);
    expect(result?.startedAt).toEqual(baseTime);
    expect(result?.endedAt).toEqual(closeTime);
    expect(ctx.toolStartTimes.has("call-e")).toBe(false);
  });

  it("should carry tool startedAt and set endedAt on tool-output-denied, then remove from map", () => {
    const ctx = ctxFor();

    map({ dynamic: false, input: {}, toolCallId: "call-d", toolName: "d", type: "tool-call" }, ctx);

    const toolStart = ctx.toolStartTimes.get("call-d");
    const closeTime = new Date(baseTime.getTime() + 1);

    vi.setSystemTime(closeTime);

    const result = map(
      { reason: "denied", toolCallId: "call-d", toolName: "d", type: "tool-output-denied" },
      ctx,
    );

    expect(result?.startedAt).toBe(toolStart);
    expect(result?.startedAt).toEqual(baseTime);
    expect(result?.endedAt).toEqual(closeTime);
    expect(ctx.toolStartTimes.has("call-d")).toBe(false);
  });

  it("should set startedAt to undefined on assistant-turn-finish when no start event preceded it", () => {
    const result = map({ finishReason: "stop", totalUsage: {}, type: "finish" }, ctxFor());

    expect(result?.startedAt).toBeUndefined();
    expect(result?.endedAt).toEqual(baseTime);
  });

  it("should set startedAt to undefined on close-events when no matching tool-call preceded them", () => {
    const ctx = ctxFor();

    const resultResult = map(
      { output: {}, toolCallId: "orphan", toolName: "x", type: "tool-result" },
      ctx,
    );

    expect(resultResult?.startedAt).toBeUndefined();
    expect(resultResult?.endedAt).toEqual(baseTime);

    const errorResult = map(
      { error: new Error("e"), toolCallId: "orphan2", toolName: "x", type: "tool-error" },
      ctx,
    );

    expect(errorResult?.startedAt).toBeUndefined();
    expect(errorResult?.endedAt).toEqual(baseTime);

    const deniedResult = map(
      { toolCallId: "orphan3", toolName: "x", type: "tool-output-denied" },
      ctx,
    );

    expect(deniedResult?.startedAt).toBeUndefined();
    expect(deniedResult?.endedAt).toEqual(baseTime);
  });

  it("should not consume the start time or set endedAt on a preliminary tool-result", () => {
    const ctx = ctxFor();

    map({ dynamic: false, input: {}, toolCallId: "call-p", toolName: "p", type: "tool-call" }, ctx);

    const preliminary = map(
      {
        output: { status: "running" },
        preliminary: true,
        toolCallId: "call-p",
        toolName: "p",
        type: "tool-result",
      },
      ctx,
    );

    expect(preliminary?.startedAt).toBeUndefined();
    expect(preliminary?.endedAt).toBeUndefined();
    expect(ctx.toolStartTimes.has("call-p")).toBe(true);
  });

  it("should consume the start time and set endedAt on the final tool-result after preliminary ones", () => {
    const ctx = ctxFor();

    map(
      { dynamic: false, input: {}, toolCallId: "call-p2", toolName: "p", type: "tool-call" },
      ctx,
    );

    map(
      {
        output: { status: "running" },
        preliminary: true,
        toolCallId: "call-p2",
        toolName: "p",
        type: "tool-result",
      },
      ctx,
    );

    const toolStart = ctx.toolStartTimes.get("call-p2");
    const closeTime = new Date(baseTime.getTime() + 1);

    vi.setSystemTime(closeTime);

    const final = map(
      { output: { status: "done" }, toolCallId: "call-p2", toolName: "p", type: "tool-result" },
      ctx,
    );

    expect(final?.startedAt).toBe(toolStart);
    expect(final?.startedAt).toEqual(baseTime);
    expect(final?.endedAt).toEqual(closeTime);
    expect(ctx.toolStartTimes.has("call-p2")).toBe(false);
  });
});
