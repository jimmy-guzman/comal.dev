import { tool } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { sandboxToolSet } from "./sandbox";

const readExecute = () => Promise.resolve({ real: "read" });
const writeExecute = () => Promise.resolve({ real: "write" });

const sandboxed = sandboxToolSet({
  "agents-delete": tool({
    description: "a write tool",
    execute: writeExecute,
    inputSchema: z.object({}),
  }),
  "web-search": tool({
    description: "a read tool",
    execute: readExecute,
    inputSchema: z.object({}),
  }),
});

const readTool = sandboxed["web-search"];
const writeTool = sandboxed["agents-delete"];

describe("sandboxToolSet", () => {
  it("should keep a read tool's execute intact", () => {
    expect(readTool.execute).toBe(readExecute);
  });

  it("should replace a write tool's execute with a stub", () => {
    expect(writeTool.execute).toBeTypeOf("function");
    expect(writeTool.execute).not.toBe(writeExecute);
  });

  it("should clear needsApproval on every tool", () => {
    expect(readTool.needsApproval).toBe(false);
    expect(writeTool.needsApproval).toBe(false);
  });
});
