import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToolCallAssertionEditor } from "@/components/tool-call-assertion-editor";

describe("ToolCallAssertionEditor", () => {
  it("should render a chip for each selected tool", () => {
    render(
      <ToolCallAssertionEditor
        onChange={vi.fn()}
        subAgents={[]}
        value={{
          mustCall: ["web-search"],
          mustCallWithArgsJson: "",
          mustNotCall: ["agents-delete"],
        }}
      />,
    );

    expect(screen.getByText("web-search")).toBeInTheDocument();
    expect(screen.getByText("agents-delete")).toBeInTheDocument();
  });

  it("should drop a tool when its chip remove button is clicked", async () => {
    const onChange = vi.fn();

    render(
      <ToolCallAssertionEditor
        onChange={onChange}
        subAgents={[]}
        value={{ mustCall: ["web-search"], mustCallWithArgsJson: "", mustNotCall: [] }}
      />,
    );

    await userEvent.click(screen.getByLabelText("remove web-search"));

    expect(onChange).toHaveBeenCalledWith({
      mustCall: [],
      mustCallWithArgsJson: "",
      mustNotCall: [],
    });
  });

  it("should report typing into the args JSON field", async () => {
    const onChange = vi.fn();

    render(
      <ToolCallAssertionEditor
        onChange={onChange}
        subAgents={[]}
        value={{ mustCall: [], mustCallWithArgsJson: "", mustNotCall: [] }}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText(/argsMatch/), "x");

    expect(onChange).toHaveBeenCalledWith({
      mustCall: [],
      mustCallWithArgsJson: "x",
      mustNotCall: [],
    });
  });
});
