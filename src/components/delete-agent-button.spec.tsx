import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteAgentButton } from "@/components/delete-agent-button";

const mockExecute = vi.fn();
const mockPush = vi.fn();

interface UseActionState {
  isPending: boolean;
  serverError: string | undefined;
}

const actionState: UseActionState = { isPending: false, serverError: undefined };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
  mockPush.mockReset();
  actionState.isPending = false;
  actionState.serverError = undefined;
});

describe("DeleteAgentButton", () => {
  it("should open the confirmation dialog when the trigger is clicked", async () => {
    const user = userEvent.setup();

    render(<DeleteAgentButton agentId="agent-1" agentName="My Agent" />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "delete" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete My Agent?")).toBeInTheDocument();
  });

  it("should open the dialog when a custom trigger is clicked", async () => {
    const user = userEvent.setup();

    render(
      <DeleteAgentButton
        agentId="agent-1"
        agentName="My Agent"
        trigger={<button type="button">Remove agent</button>}
      />,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove agent" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("should call execute with agentId when delete is confirmed", async () => {
    const user = userEvent.setup();

    render(<DeleteAgentButton agentId="agent-1" agentName="My Agent" />);

    await user.click(screen.getByRole("button", { name: "delete" }));

    const dialog = screen.getByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: "delete" }));

    expect(mockExecute).toHaveBeenCalledWith({ agentId: "agent-1" });
  });

  it("should navigate to /agents on success", async () => {
    const user = userEvent.setup();

    render(<DeleteAgentButton agentId="agent-1" agentName="My Agent" />);

    await user.click(screen.getByRole("button", { name: "delete" }));

    const dialog = screen.getByRole("alertdialog");

    await user.click(within(dialog).getByRole("button", { name: "delete" }));

    expect(mockPush).toHaveBeenCalledWith("/agents");
  });

  it("should disable the dialog buttons and show deleting... while pending", async () => {
    actionState.isPending = true;

    const user = userEvent.setup();

    render(<DeleteAgentButton agentId="agent-1" agentName="My Agent" />);

    await user.click(screen.getByRole("button", { name: "delete" }));

    const dialog = screen.getByRole("alertdialog");

    expect(within(dialog).getByRole("button", { name: "deleting..." })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "cancel" })).toBeDisabled();
  });

  it("should show a server error when the action fails", async () => {
    actionState.serverError = "Something went wrong.";

    const user = userEvent.setup();

    render(<DeleteAgentButton agentId="agent-1" agentName="My Agent" />);

    await user.click(screen.getByRole("button", { name: "delete" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
  });
});
