import { describe, expect, it } from "vitest";

import type { TraceEventRow } from "./store";

import { projectTrace } from "./trace";

const baseTime = new Date("2025-01-01T00:00:00Z");

const event = (
  overrides: Partial<TraceEventRow> & Pick<TraceEventRow, "eventType" | "payload" | "sequence">,
): TraceEventRow => {
  return {
    costMicrodollars: null,
    createdAt: baseTime,
    endedAt: null,
    messageId: null,
    modelId: null,
    parentToolCallId: null,
    role: "assistant",
    startedAt: baseTime,
    ...overrides,
  };
};

describe("projectTrace", () => {
  it("should attach direct children of a top-level tool call", () => {
    const steps = projectTrace(
      [
        event({
          eventType: "tool-input-complete",
          payload: { input: {}, toolCallId: "parent-call", toolName: "subagent_x" },
          sequence: 1,
        }),
        event({
          eventType: "text-segment",
          parentToolCallId: "parent-call",
          payload: { text: "child says hi" },
          sequence: 2,
        }),
      ],
      baseTime,
    );

    expect(steps).toMatchObject([
      {
        children: [{ eventType: "text-segment" }],
        tool: { toolCallId: "parent-call" },
      },
    ]);
  });

  it("should attach grandchildren under nested child tool calls", () => {
    const steps = projectTrace(
      [
        event({
          eventType: "tool-input-complete",
          payload: { input: {}, toolCallId: "parent-call", toolName: "subagent_x" },
          sequence: 1,
        }),
        event({
          eventType: "tool-input-complete",
          parentToolCallId: "parent-call",
          payload: { input: {}, toolCallId: "child-call", toolName: "subagent_y" },
          sequence: 2,
        }),
        event({
          eventType: "text-segment",
          parentToolCallId: "child-call",
          payload: { text: "grandchild says hi" },
          sequence: 3,
        }),
      ],
      baseTime,
    );

    expect(steps).toMatchObject([
      {
        children: [
          {
            children: [{ eventType: "text-segment" }],
            tool: { toolCallId: "child-call" },
          },
        ],
        tool: { toolCallId: "parent-call" },
      },
    ]);
  });

  it("should leave children empty when no grandchildren exist", () => {
    const steps = projectTrace(
      [
        event({
          eventType: "tool-input-complete",
          payload: { input: {}, toolCallId: "parent-call", toolName: "search" },
          sequence: 1,
        }),
        event({
          eventType: "tool-output-available",
          payload: { output: {}, toolCallId: "parent-call", toolName: "search" },
          sequence: 2,
        }),
      ],
      baseTime,
    );

    expect(steps).toMatchObject([{ children: [], tool: { toolCallId: "parent-call" } }]);
  });
});
