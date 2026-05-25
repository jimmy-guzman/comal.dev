import { strict as assert } from "node:assert";

import { describe, expect, it } from "vitest";

import type { FetchedAgent } from "./agent-export";

import { walkAgentGraph } from "./agent-export";

const makeFetched = (overrides: Partial<FetchedAgent> & Pick<FetchedAgent, "id" | "name">) => {
  return {
    createdAt: new Date("2025-01-01T00:00:00Z"),
    defaultModelId: "anthropic/claude-haiku-4.5",
    description: null,
    enableMemory: false,
    evals: [],
    isSystem: false,
    subAgents: [],
    suggestions: [],
    systemPrompt: "Be helpful.",
    tools: [],
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    userId: "user-1",
    ...overrides,
  } satisfies FetchedAgent;
};

describe("walkAgentGraph", () => {
  it("should map a single agent into the export shape", () => {
    const fetched = new Map<string, FetchedAgent>([
      [
        "a",
        makeFetched({
          defaultModelId: "anthropic/claude-sonnet-4.6",
          description: "test agent",
          evals: [
            {
              assertion: null,
              expected: "yes",
              id: "eval-1",
              input: "say yes",
              name: "yes-check",
              scorer: "exact",
              trials: 1,
            },
          ],
          id: "a",
          name: "Alpha",
          systemPrompt: "You are Alpha.",
          tools: [{ config: { needsApproval: false }, toolId: "web.fetch" }],
        }),
      ],
    ]);

    expect(walkAgentGraph("a", fetched)).toStrictEqual({
      defaultModelId: "anthropic/claude-sonnet-4.6",
      description: "test agent",
      evals: [{ expected: "yes", input: "say yes", name: "yes-check", scorer: "exact", trials: 1 }],
      id: "a",
      name: "Alpha",
      subAgents: [],
      suggestions: [],
      systemPrompt: "You are Alpha.",
      tools: [{ config: { needsApproval: false }, toolId: "web.fetch" }],
    });
  });

  it("should include suggestions in the export when present", () => {
    const fetched = new Map<string, FetchedAgent>([
      [
        "a",
        makeFetched({
          id: "a",
          name: "Alpha",
          suggestions: ["build something", "show me an example"],
        }),
      ],
    ]);

    expect(walkAgentGraph("a", fetched).suggestions).toStrictEqual([
      "build something",
      "show me an example",
    ]);
  });

  it("should omit description when the agent has no description", () => {
    const fetched = new Map<string, FetchedAgent>([
      ["a", makeFetched({ description: null, id: "a", name: "Alpha" })],
    ]);

    expect(walkAgentGraph("a", fetched)).not.toHaveProperty("description");
  });

  it("should omit eval expected when stored as null", () => {
    const fetched = new Map<string, FetchedAgent>([
      [
        "a",
        makeFetched({
          evals: [
            {
              assertion: null,
              expected: null,
              id: "eval-1",
              input: "what is 2+2",
              name: "math",
              scorer: "llm-judge",
              trials: 1,
            },
          ],
          id: "a",
          name: "Alpha",
        }),
      ],
    ]);

    const node = walkAgentGraph("a", fetched);
    const evalEntry = node.evals[0];

    assert.ok(evalEntry);

    expect(evalEntry).not.toHaveProperty("expected");
    expect(evalEntry).not.toHaveProperty("id");
  });

  it("should inline a direct sub-agent's full config", () => {
    const fetched = new Map<string, FetchedAgent>([
      [
        "child",
        makeFetched({
          defaultModelId: "anthropic/claude-haiku-4.5",
          id: "child",
          name: "Child",
          systemPrompt: "You are Child.",
        }),
      ],
      [
        "parent",
        makeFetched({
          id: "parent",
          name: "Parent",
          subAgents: [
            { alias: "helper", childAgentId: "child", descriptionOverride: "do the thing" },
          ],
        }),
      ],
    ]);

    const node = walkAgentGraph("parent", fetched);
    const sub = node.subAgents[0];

    assert.ok(sub);

    expect(sub).toMatchObject({ alias: "helper", descriptionOverride: "do the thing" });
    expect(sub.child).toMatchObject({
      defaultModelId: "anthropic/claude-haiku-4.5",
      id: "child",
      name: "Child",
      systemPrompt: "You are Child.",
    });
  });

  it("should omit descriptionOverride when stored as null", () => {
    const fetched = new Map<string, FetchedAgent>([
      ["child", makeFetched({ id: "child", name: "Child" })],
      [
        "parent",
        makeFetched({
          id: "parent",
          name: "Parent",
          subAgents: [{ alias: "helper", childAgentId: "child", descriptionOverride: null }],
        }),
      ],
    ]);

    const sub = walkAgentGraph("parent", fetched).subAgents[0];

    assert.ok(sub);

    expect(sub).not.toHaveProperty("descriptionOverride");
  });

  it("should break a cycle with a stub carrying the ancestor's name", () => {
    const fetched = new Map<string, FetchedAgent>([
      [
        "a",
        makeFetched({
          id: "a",
          name: "Alpha",
          subAgents: [{ alias: "to-b", childAgentId: "b", descriptionOverride: null }],
        }),
      ],
      [
        "b",
        makeFetched({
          id: "b",
          name: "Beta",
          subAgents: [{ alias: "back-to-a", childAgentId: "a", descriptionOverride: null }],
        }),
      ],
    ]);

    const node = walkAgentGraph("a", fetched);
    const betaSub = node.subAgents[0];

    assert.ok(betaSub);
    const beta = betaSub.child;

    expect(beta).toMatchObject({ id: "b", name: "Beta" });

    assert.ok(!("cycle" in beta), "Beta should not be a cycle stub on the first visit.");

    const backToAlpha = beta.subAgents[0];

    assert.ok(backToAlpha);

    expect(backToAlpha.child).toStrictEqual({ cycle: true, id: "a", name: "Alpha" });
  });
});
