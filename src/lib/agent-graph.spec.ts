import { describe, expect, it } from "vitest";

import { detectCycle, detectSubAgentCycle } from "./agent-graph";

describe("detectCycle", () => {
  it("should return null for a single node with no edges", () => {
    const edges = new Map<string, string[]>([["a", []]]);

    expect(detectCycle(edges, "a")).toBeNull();
  });

  it("should return null for a tree reachable from start", () => {
    const edges = new Map<string, string[]>([
      ["a", ["c"]],
      ["b", []],
      ["c", []],
      ["root", ["a", "b"]],
    ]);

    expect(detectCycle(edges, "root")).toBeNull();
  });

  it("should detect a self-loop", () => {
    const edges = new Map<string, string[]>([["a", ["a"]]]);

    expect(detectCycle(edges, "a")).toStrictEqual(["a", "a"]);
  });

  it("should detect a two-node cycle", () => {
    const edges = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);

    expect(detectCycle(edges, "a")).toStrictEqual(["a", "b", "a"]);
  });

  it("should detect a deeper cycle reachable from start", () => {
    const edges = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]],
    ]);

    expect(detectCycle(edges, "a")).toStrictEqual(["a", "b", "c", "a"]);
  });

  it("should return the cycle path starting at the cycle entry, not at start", () => {
    const edges = new Map<string, string[]>([
      ["a", ["b"]],
      ["b", ["a"]],
      ["start", ["a"]],
    ]);

    expect(detectCycle(edges, "start")).toStrictEqual(["a", "b", "a"]);
  });

  it("should ignore cycles unreachable from start", () => {
    const edges = new Map<string, string[]>([
      ["a", []],
      ["start", ["a"]],
      ["x", ["y"]],
      ["y", ["x"]],
    ]);

    expect(detectCycle(edges, "start")).toBeNull();
  });

  it("should not flag a diamond as a cycle", () => {
    const edges = new Map<string, string[]>([
      ["a", ["leaf"]],
      ["b", ["leaf"]],
      ["leaf", []],
      ["root", ["a", "b"]],
    ]);

    expect(detectCycle(edges, "root")).toBeNull();
  });

  it("should treat unknown child ids as leaves", () => {
    const edges = new Map<string, string[]>([["a", ["unknown"]]]);

    expect(detectCycle(edges, "a")).toBeNull();
  });
});

describe("detectSubAgentCycle", () => {
  it("should return null when the new children have no path back to the parent", () => {
    const edges = [{ childAgentId: "c", parentAgentId: "b" }];

    expect(detectSubAgentCycle(edges, "a", ["b"])).toBeNull();
  });

  it("should detect a self-link as a cycle", () => {
    expect(detectSubAgentCycle([], "a", ["a"])).toStrictEqual(["a", "a"]);
  });

  it("should detect the two-node race: adding a -> b while b -> a already exists", () => {
    const edges = [{ childAgentId: "a", parentAgentId: "b" }];

    expect(detectSubAgentCycle(edges, "a", ["b"])).toStrictEqual(["a", "b", "a"]);
  });

  it("should detect a deeper cycle closed by the proposed edge", () => {
    const edges = [
      { childAgentId: "c1", parentAgentId: "p1" },
      { childAgentId: "p2", parentAgentId: "c1" },
      { childAgentId: "p1", parentAgentId: "c2" },
    ];

    expect(detectSubAgentCycle(edges, "p2", ["c2"])).toStrictEqual(["p2", "c2", "p1", "c1", "p2"]);
  });

  it("should return null when replacing the parent's children breaks an existing cycle", () => {
    const edges = [
      { childAgentId: "b", parentAgentId: "a" },
      { childAgentId: "a", parentAgentId: "b" },
    ];

    expect(detectSubAgentCycle(edges, "a", [])).toBeNull();
  });
});
