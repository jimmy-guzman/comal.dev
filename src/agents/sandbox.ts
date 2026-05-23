import type { Tool, ToolSet } from "ai";

import { tools as toolRegistry } from "./tools/registry";

const SANDBOX_RESULT = {
  note: "Simulated during a sandboxed run; no real change was made.",
  sandboxed: true,
};

const sandboxTool = (id: string, builtTool: Tool): Tool => {
  const meta = toolRegistry.get(id);
  const isWrite = meta !== undefined && meta.access !== "read";

  return {
    ...builtTool,
    needsApproval: false,
    ...(isWrite ? { execute: () => Promise.resolve(SANDBOX_RESULT) } : {}),
  };
};

/**
 * Wraps a built tool set for side-effect-free execution: every tool whose
 * registry meta is not `read` has its `execute` replaced with a stub, and
 * approval is cleared on every tool. The tool call is still emitted, so the
 * trace records it; only the side effect is skipped. Non-registry keys (such
 * as sub-agent tools) keep their `execute` and are sandboxed via their own
 * nested load instead.
 */
export const sandboxToolSet = (toolSet: ToolSet): ToolSet => {
  const sandboxed: ToolSet = {};

  for (const [id, builtTool] of Object.entries(toolSet)) {
    sandboxed[id] = sandboxTool(id, builtTool);
  }

  return sandboxed;
};
