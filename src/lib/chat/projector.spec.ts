import { describe, expect, it } from "vitest";

import type { ChatEventRow } from "./projector";

import { projectMessages } from "./projector";

const event = (
  overrides: Partial<ChatEventRow> & Pick<ChatEventRow, "eventType" | "payload">,
): ChatEventRow => {
  return {
    messageId: "msg-1",
    role: "assistant",
    sequence: 1,
    ...overrides,
  };
};

describe("projectMessages", () => {
  it("should return empty array for no events", () => {
    expect(projectMessages([])).toStrictEqual([]);
  });

  it("should project a user message", () => {
    const result = projectMessages([
      event({
        eventType: "user-message",
        messageId: "u1",
        payload: { parts: [{ text: "hello", type: "text" }] },
        role: "user",
        sequence: 1,
      }),
    ]);

    expect(result).toStrictEqual([
      {
        id: "u1",
        parts: [{ text: "hello", type: "text" }],
        role: "user",
      },
    ]);
  });

  it("should project assistant text segments in order", () => {
    const result = projectMessages([
      event({ eventType: "assistant-turn-start", payload: { modelId: "gpt-x" }, sequence: 1 }),
      event({
        eventType: "text-segment",
        payload: { segmentId: "t1", text: "Hello " },
        sequence: 2,
      }),
      event({
        eventType: "text-segment",
        payload: { segmentId: "t2", text: "world" },
        sequence: 3,
      }),
      event({ eventType: "assistant-turn-finish", payload: {}, sequence: 4 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("assistant");
    expect(result[0]?.parts).toStrictEqual([
      { state: "done", text: "Hello ", type: "text" },
      { state: "done", text: "world", type: "text" },
    ]);
  });

  it("should fold tool lifecycle: input -> output", () => {
    const result = projectMessages([
      event({ eventType: "assistant-turn-start", payload: { modelId: null }, sequence: 1 }),
      event({
        eventType: "tool-input-complete",
        payload: { input: { q: "weather" }, toolCallId: "call-1", toolName: "search" },
        sequence: 2,
      }),
      event({
        eventType: "tool-output-available",
        payload: { output: { result: "sunny" }, toolCallId: "call-1", toolName: "search" },
        sequence: 3,
      }),
    ]);

    expect(result[0]?.parts).toHaveLength(1);

    const part = result[0]?.parts[0] as {
      input: unknown;
      output: unknown;
      state: string;
      toolCallId: string;
      type: string;
    };

    expect(part.type).toBe("dynamic-tool");
    expect(part.state).toBe("output-available");
    expect(part.input).toStrictEqual({ q: "weather" });
    expect(part.output).toStrictEqual({ result: "sunny" });
  });

  it("should fold approval lifecycle preserving approval object", () => {
    const result = projectMessages([
      event({ eventType: "assistant-turn-start", payload: { modelId: null }, sequence: 1 }),
      event({
        eventType: "tool-approval-requested",
        payload: {
          approval: { id: "appr-1" },
          input: { cmd: "rm -rf /" },
          toolCallId: "call-2",
          toolName: "shell",
        },
        sequence: 2,
      }),
      event({
        eventType: "tool-approval-responded",
        payload: {
          approval: { id: "appr-1" },
          approved: true,
          toolCallId: "call-2",
          toolName: "shell",
        },
        sequence: 3,
      }),
      event({
        eventType: "tool-output-available",
        payload: { output: "ok", toolCallId: "call-2", toolName: "shell" },
        sequence: 4,
      }),
    ]);

    const part = result[0]?.parts[0] as {
      approval: { approved: boolean; id: string };
      input: unknown;
      output: unknown;
      state: string;
    };

    expect(part.state).toBe("output-available");
    expect(part.output).toBe("ok");
    expect(part.input).toStrictEqual({ cmd: "rm -rf /" });
    expect(part.approval).toMatchObject({ approved: true, id: "appr-1" });
  });

  it("should not regress tool state when out-of-order events arrive", () => {
    const result = projectMessages([
      event({ eventType: "assistant-turn-start", payload: { modelId: null }, sequence: 1 }),
      event({
        eventType: "tool-output-available",
        payload: { output: "done", toolCallId: "call-3", toolName: "x" },
        sequence: 3,
      }),
      event({
        eventType: "tool-input-complete",
        payload: { input: { a: 1 }, toolCallId: "call-3", toolName: "x" },
        sequence: 2,
      }),
    ]);

    const part = result[0]?.parts[0] as { input: unknown; output: unknown; state: string };

    expect(part.state).toBe("output-available");
    expect(part.output).toBe("done");
    expect(part.input).toStrictEqual({ a: 1 });
  });

  it("should collapse consecutive step-boundary events", () => {
    const result = projectMessages([
      event({ eventType: "assistant-turn-start", payload: { modelId: null }, sequence: 1 }),
      event({ eventType: "text-segment", payload: { segmentId: "t1", text: "a" }, sequence: 2 }),
      event({ eventType: "step-boundary", payload: {}, sequence: 3 }),
      event({ eventType: "step-boundary", payload: {}, sequence: 4 }),
      event({ eventType: "text-segment", payload: { segmentId: "t2", text: "b" }, sequence: 5 }),
    ]);

    const types = result[0]?.parts.map((p) => p.type) ?? [];

    expect(types).toStrictEqual(["text", "step-start", "text"]);
  });

  it("should trim leading and trailing step-start", () => {
    const result = projectMessages([
      event({ eventType: "assistant-turn-start", payload: { modelId: null }, sequence: 1 }),
      event({ eventType: "step-boundary", payload: {}, sequence: 2 }),
      event({ eventType: "text-segment", payload: { segmentId: "t1", text: "x" }, sequence: 3 }),
      event({ eventType: "step-boundary", payload: {}, sequence: 4 }),
    ]);

    expect(result[0]?.parts.map((p) => p.type)).toStrictEqual(["text"]);
  });

  it("should interleave user and assistant messages by messageId grouping", () => {
    const result = projectMessages([
      event({
        eventType: "user-message",
        messageId: "u1",
        payload: { parts: [{ text: "hi", type: "text" }] },
        role: "user",
        sequence: 1,
      }),
      event({
        eventType: "assistant-turn-start",
        messageId: "a1",
        payload: { modelId: null },
        sequence: 2,
      }),
      event({
        eventType: "text-segment",
        messageId: "a1",
        payload: { segmentId: "t1", text: "hi back" },
        sequence: 3,
      }),
      event({
        eventType: "user-message",
        messageId: "u2",
        payload: { parts: [{ text: "more", type: "text" }] },
        role: "user",
        sequence: 4,
      }),
      event({
        eventType: "assistant-turn-start",
        messageId: "a2",
        payload: { modelId: null },
        sequence: 5,
      }),
      event({
        eventType: "text-segment",
        messageId: "a2",
        payload: { segmentId: "t2", text: "ok" },
        sequence: 6,
      }),
    ]);

    expect(result.map((m) => `${m.role}:${m.id}`)).toStrictEqual([
      "user:u1",
      "assistant:a1",
      "user:u2",
      "assistant:a2",
    ]);
  });

  it("should drop empty assistant messages", () => {
    const result = projectMessages([
      event({ eventType: "assistant-turn-start", payload: { modelId: null }, sequence: 1 }),
      event({ eventType: "assistant-turn-finish", payload: {}, sequence: 2 }),
    ]);

    expect(result).toStrictEqual([]);
  });

  it("should preserve order regardless of input order via sequence sort", () => {
    const result = projectMessages([
      event({
        eventType: "text-segment",
        payload: { segmentId: "t2", text: "second" },
        sequence: 3,
      }),
      event({ eventType: "assistant-turn-start", payload: { modelId: null }, sequence: 1 }),
      event({
        eventType: "text-segment",
        payload: { segmentId: "t1", text: "first " },
        sequence: 2,
      }),
    ]);

    expect(result[0]?.parts.map((p) => (p as { text: string }).text)).toStrictEqual([
      "first ",
      "second",
    ]);
  });

  it("should coalesce tool lifecycle across split messageIds into the originating bubble", () => {
    const result = projectMessages([
      event({
        eventType: "user-message",
        messageId: "u1",
        payload: { parts: [{ text: "fetch", type: "text" }] },
        role: "user",
        sequence: 1,
      }),
      event({
        eventType: "assistant-turn-start",
        messageId: "a1",
        payload: { modelId: null },
        sequence: 2,
      }),
      event({
        eventType: "tool-input-complete",
        messageId: "a1",
        payload: { input: { url: "x" }, toolCallId: "call-x", toolName: "webFetch" },
        sequence: 3,
      }),
      event({
        eventType: "tool-approval-requested",
        messageId: "a1",
        payload: {
          approval: { id: "appr-x" },
          input: { url: "x" },
          toolCallId: "call-x",
          toolName: "webFetch",
        },
        sequence: 4,
      }),
      event({ eventType: "assistant-turn-finish", messageId: "a1", payload: {}, sequence: 5 }),
      event({
        eventType: "tool-approval-responded",
        messageId: "a2",
        payload: {
          approval: { id: "appr-x" },
          approved: true,
          toolCallId: "call-x",
          toolName: "webFetch",
        },
        sequence: 6,
      }),
      event({
        eventType: "assistant-turn-start",
        messageId: "a2",
        payload: { modelId: null },
        sequence: 7,
      }),
      event({
        eventType: "tool-output-available",
        messageId: "a2",
        payload: { output: { ok: true }, toolCallId: "call-x", toolName: "webFetch" },
        sequence: 8,
      }),
    ]);

    const assistant = result.filter((m) => m.role === "assistant");

    expect(assistant).toHaveLength(1);
    expect(assistant[0]?.id).toBe("a1");

    const part = assistant[0]?.parts[0] as {
      input: unknown;
      output: unknown;
      state: string;
      toolCallId: string;
      type: string;
    };

    expect(part.type).toBe("dynamic-tool");
    expect(part.toolCallId).toBe("call-x");
    expect(part.state).toBe("output-available");
    expect(part.input).toStrictEqual({ url: "x" });
    expect(part.output).toStrictEqual({ ok: true });
  });
});
