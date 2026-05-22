import { describe, expect, it } from "vitest";

import { evalEntrySchema, toolCallAssertionSchema } from "./eval-input-schema";

describe("toolCallAssertionSchema", () => {
  it("should reject an assertion with no constraints", () => {
    expect(toolCallAssertionSchema.safeParse({}).success).toBe(false);
  });

  it("should reject a tool listed in both mustCall and mustNotCall", () => {
    const result = toolCallAssertionSchema.safeParse({
      mustCall: ["web-search"],
      mustNotCall: ["web-search"],
    });

    expect(result.success).toBe(false);
  });

  it("should reject an unknown tool id", () => {
    expect(toolCallAssertionSchema.safeParse({ mustCall: ["not-a-real-tool"] }).success).toBe(
      false,
    );
  });

  it("should accept a registry tool id", () => {
    expect(toolCallAssertionSchema.safeParse({ mustCall: ["web-search"] }).success).toBe(true);
  });

  it("should accept a sub-agent tool name", () => {
    expect(toolCallAssertionSchema.safeParse({ mustCall: ["subagent_research"] }).success).toBe(
      true,
    );
  });
});

describe("evalEntrySchema", () => {
  it("should require an assertion for the tool-call scorer", () => {
    expect(() => {
      evalEntrySchema.parse({ input: "do something", name: "uses tools", scorer: "tool-call" });
    }).toThrow(/assertion/i);
  });

  it("should force a single trial and drop expected for a tool-call eval", () => {
    const data = evalEntrySchema.parse({
      assertion: { mustCall: ["web-search"] },
      expected: "ignored",
      input: "do something",
      name: "uses tools",
      scorer: "tool-call",
      trials: 5,
    });

    expect(data.trials).toBe(1);
    expect(data.expected).toBeUndefined();
  });

  it("should still require expected for string scorers", () => {
    expect(() => {
      evalEntrySchema.parse({ input: "hello", name: "greets", scorer: "contains" });
    }).toThrow(/expected/i);
  });
});
