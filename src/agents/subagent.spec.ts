import { describe, expect, it } from "vitest";

import { buildSubagentTool } from "./subagent";

const subagentTool = buildSubagentTool({
  childDescription: "Fetches the latest NBA news.",
  childName: "nba-news-getter",
  link: { alias: "nba-news-getter", childAgentId: "child-agent", descriptionOverride: null },
  ownerId: "owner",
  sandbox: false,
});

const { toModelOutput } = subagentTool;

if (!toModelOutput) {
  throw new Error("buildSubagentTool must define toModelOutput");
}

describe("buildSubagentTool toModelOutput", () => {
  it("should hand the parent model the sub-agent's answer once the run is done", () => {
    const result = toModelOutput({
      input: { prompt: "What's the latest NBA news?" },
      output: { runId: "run-1", status: "done", text: "The Knicks beat the Cavs." },
      toolCallId: "call-1",
    });

    expect(result).toStrictEqual({
      type: "content",
      value: [{ text: "The Knicks beat the Cavs.", type: "text" }],
    });
  });

  it("should hand the parent model nothing while the run is still streaming", () => {
    const result = toModelOutput({
      input: { prompt: "What's the latest NBA news?" },
      output: { messages: [], runId: "run-1", status: "running" },
      toolCallId: "call-1",
    });

    expect(result).toStrictEqual({
      type: "content",
      value: [{ text: "", type: "text" }],
    });
  });
});
