import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RecentConversation } from "@/components/conversations-context";

import { ConversationsProvider } from "@/components/conversations-provider";
import { useConversations } from "@/hooks/use-conversations";

const conv = (id: string, title = "t"): RecentConversation => {
  return { agentId: "a", agentName: "A", id, title };
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  return <ConversationsProvider>{children}</ConversationsProvider>;
};

describe("ConversationsProvider", () => {
  it("should expose the initial list to consumers after seeding", () => {
    const { result } = renderHook(() => useConversations(), { wrapper });

    act(() => {
      result.current.seedConversations([conv("1"), conv("2")]);
    });

    expect(result.current.conversations.map((c) => c.id)).toStrictEqual(["1", "2"]);
  });

  it("should prepend a new conversation", () => {
    const { result } = renderHook(() => useConversations(), { wrapper });

    act(() => {
      result.current.seedConversations([conv("1")]);
    });

    act(() => {
      result.current.prependConversation(conv("2"));
    });

    expect(result.current.conversations.map((c) => c.id)).toStrictEqual(["2", "1"]);
  });

  it("should ignore prepend when the id already exists", () => {
    const { result } = renderHook(() => useConversations(), { wrapper });

    act(() => {
      result.current.seedConversations([conv("1")]);
    });

    act(() => {
      result.current.prependConversation(conv("1", "different"));
    });

    expect(result.current.conversations).toStrictEqual([conv("1")]);
  });

  it("should update an existing conversation title", () => {
    const { result } = renderHook(() => useConversations(), { wrapper });

    act(() => {
      result.current.seedConversations([conv("1", "old"), conv("2", "keep")]);
    });

    act(() => {
      result.current.updateConversationTitle("1", "new");
    });

    expect(result.current.conversations).toStrictEqual([
      { ...conv("1"), title: "new" },
      conv("2", "keep"),
    ]);
  });

  it("should replace state when seeded again", () => {
    const { result } = renderHook(() => useConversations(), { wrapper });

    act(() => {
      result.current.seedConversations([conv("1")]);
    });

    act(() => {
      result.current.seedConversations([conv("2"), conv("3")]);
    });

    expect(result.current.conversations.map((c) => c.id)).toStrictEqual(["2", "3"]);
  });

  it("should throw when used outside a provider", () => {
    expect(() => renderHook(() => useConversations())).toThrow(
      /must be used within a ConversationsProvider/,
    );
  });
});
