import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { MessageResponse } from "@/components/ai-elements/message";

interface MockLinkHref {
  hash?: string;
  pathname: string;
  search?: string;
}

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: MockLinkHref | string }) => {
    const resolved =
      typeof href === "string" ? href : `${href.pathname}${href.search ?? ""}${href.hash ?? ""}`;

    return <a href={resolved}>{children}</a>;
  },
}));

describe("MessageResponse markdown links", () => {
  it("renders an internal link as an in-app anchor without a safety modal", () => {
    render(<MessageResponse>{"See [Research Helper](/agents/abc123)."}</MessageResponse>);

    expect(screen.getByRole("link", { name: "Research Helper" })).toHaveAttribute(
      "href",
      "/agents/abc123",
    );
    expect(screen.queryByRole("button", { name: "Research Helper" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("gates an external link behind the safety modal", async () => {
    const user = userEvent.setup();

    render(<MessageResponse>{"Visit [Anthropic](https://anthropic.com)."}</MessageResponse>);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Anthropic" }));

    const dialog = screen.getByRole("alertdialog");

    expect(dialog).toHaveTextContent("Open external link?");
    expect(dialog).toHaveTextContent("https://anthropic.com");
  });

  it("opens the external link when the safety modal is confirmed", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    render(<MessageResponse>{"Visit [Anthropic](https://anthropic.com)."}</MessageResponse>);

    await user.click(screen.getByRole("button", { name: "Anthropic" }));
    await user.click(screen.getByRole("button", { name: "Open link" }));

    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("anthropic.com"),
      "_blank",
      "noreferrer",
    );

    open.mockRestore();
  });
});
