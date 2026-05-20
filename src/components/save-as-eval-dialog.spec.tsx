import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SaveAsEvalDialog } from "@/components/save-as-eval-dialog";

const mockExecute = vi.fn();

interface UseActionState {
  isPending: boolean;
  serverError: string | undefined;
}

const actionState: UseActionState = { isPending: false, serverError: undefined };

function makeUseAction(_action: unknown, opts: { onSuccess?: () => void }) {
  const execute = (...args: Parameters<typeof mockExecute>) => {
    mockExecute(...args);

    if (!actionState.isPending && actionState.serverError === undefined) {
      opts.onSuccess?.();
    }
  };

  return {
    execute,
    isPending: actionState.isPending,
    result: { serverError: actionState.serverError },
  };
}

vi.mock("next-safe-action/hooks", () => ({
  useAction: makeUseAction,
}));

beforeEach(() => {
  mockExecute.mockReset();
  actionState.isPending = false;
  actionState.serverError = undefined;
});

describe("SaveAsEvalDialog", () => {
  it("should pre-fill input and expected from the conversation turn", () => {
    render(
      <SaveAsEvalDialog
        agentId="agent-1"
        defaultExpected="it is sunny and 72F"
        defaultInput="what's the weather?"
        onOpenChange={vi.fn()}
        open
      />,
    );

    expect(screen.getByLabelText("input")).toHaveValue("what's the weather?");
    expect(screen.getByLabelText("expected")).toHaveValue("it is sunny and 72F");
    expect(screen.getByLabelText("name")).toHaveValue("");
  });

  it("should not submit when the name is blank", async () => {
    const user = userEvent.setup();

    render(
      <SaveAsEvalDialog
        agentId="agent-1"
        defaultExpected="it is sunny"
        defaultInput="what's the weather?"
        onOpenChange={vi.fn()}
        open
      />,
    );

    await user.click(screen.getByRole("button", { name: "save" }));

    expect(mockExecute).not.toHaveBeenCalled();
    expect(screen.getByLabelText("name")).toHaveAttribute("aria-invalid", "true");
  });

  it("should save the turn as an eval entry", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <SaveAsEvalDialog
        agentId="agent-1"
        defaultExpected="it is sunny"
        defaultInput="what's the weather?"
        onOpenChange={onOpenChange}
        open
      />,
    );

    await user.type(screen.getByLabelText("name"), "weather greeting");
    await user.click(screen.getByRole("button", { name: "save" }));

    expect(mockExecute).toHaveBeenCalledWith({
      agentId: "agent-1",
      entry: {
        expected: "it is sunny",
        input: "what's the weather?",
        name: "weather greeting",
        scorer: "contains",
      },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should show a server error when saving fails", () => {
    actionState.serverError = "Something went wrong.";

    render(
      <SaveAsEvalDialog
        agentId="agent-1"
        defaultExpected="it is sunny"
        defaultInput="what's the weather?"
        onOpenChange={vi.fn()}
        open
      />,
    );

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });
});
