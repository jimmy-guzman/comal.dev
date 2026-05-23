import { describe, expect, it } from "vitest";

import { scoreToolCall } from "./eval-scorer";

describe("scoreToolCall", () => {
  it("should score 1 when every mustCall tool was called", () => {
    const result = scoreToolCall({ mustCall: ["web-search", "agents-create"] }, [
      { input: {}, toolName: "web-search" },
      { input: {}, toolName: "agents-create" },
    ]);

    expect(result.score).toBe(1);
  });

  it("should score 0 when no constraint is satisfied", () => {
    const result = scoreToolCall({ mustCall: ["web-search"] }, []);

    expect(result.score).toBe(0);
  });

  it("should score the fraction of satisfied constraints", () => {
    const result = scoreToolCall({ mustCall: ["web-search", "agents-create"] }, [
      { input: {}, toolName: "web-search" },
    ]);

    expect(result.score).toBe(0.5);
  });

  it("should satisfy mustNotCall when the tool was not called", () => {
    const result = scoreToolCall({ mustNotCall: ["agents-delete"] }, [
      { input: {}, toolName: "web-search" },
    ]);

    expect(result.score).toBe(1);
  });

  it("should fail mustNotCall when the tool was called", () => {
    const result = scoreToolCall({ mustNotCall: ["agents-delete"] }, [
      { input: {}, toolName: "agents-delete" },
    ]);

    expect(result.score).toBe(0);
  });

  it("should satisfy mustCallWithArgs on a partial args match", () => {
    const result = scoreToolCall(
      { mustCallWithArgs: [{ argsMatch: { query: "movies" }, tool: "web-search" }] },
      [{ input: { format: "json", query: "movies" }, toolName: "web-search" }],
    );

    expect(result.score).toBe(1);
  });

  it("should fail mustCallWithArgs when the args do not match", () => {
    const result = scoreToolCall(
      { mustCallWithArgs: [{ argsMatch: { query: "movies" }, tool: "web-search" }] },
      [{ input: { query: "music" }, toolName: "web-search" }],
    );

    expect(result.score).toBe(0);
  });

  it("should list each constraint in the rationale", () => {
    const result = scoreToolCall({ mustCall: ["web-search"], mustNotCall: ["agents-delete"] }, [
      { input: {}, toolName: "web-search" },
    ]);

    expect(result.rationale).toContain("must call web-search");
    expect(result.rationale).toContain("must not call agents-delete");
  });

  it("should display a sub-agent invocation by its alias", () => {
    const result = scoreToolCall({ mustCall: ["subagent_research"] }, [
      { input: {}, toolName: "subagent_research" },
    ]);

    expect(result.rationale).toContain("research (sub-agent)");
  });
});
