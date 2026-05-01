import { describe, expect, it } from "vitest";

import { detectCycle } from "./agent-graph";

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
