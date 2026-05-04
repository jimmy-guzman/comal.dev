import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";

import { ChatView } from "@/components/chat-view";
import { ConversationsProvider } from "@/components/conversations-provider";
import { server } from "@/test/msw-server";

vi.mock("next/navigation", () => {
  return {
    useRouter: () => {
      return {
        back: vi.fn(),
        forward: vi.fn(),
        prefetch: vi.fn(),
        push: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
      };
    },
  };
});

vi.mock("@/components/chat-model-picker", () => ({
  ChatModelPicker: () => null,
}));

vi.mock("@/components/message-parts", () => {
  return {
    MessageParts: ({ message }: { message: { id: string; role: string } }) => {
      return <div aria-label={`message ${message.id}`}>{message.role}</div>;
    },
  };
});

const buildStreamResponse = (options: { conversationId?: string; messageId: string }) => {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      if (options.conversationId !== undefined) {
        writer.write({
          data: { id: options.conversationId },
          transient: true,
          type: "data-conversation-created",
        });
      }

      writer.write({ messageId: options.messageId, type: "start" });
      writer.write({ type: "start-step" });
      writer.write({ id: "text-1", type: "text-start" });
      writer.write({ delta: "ok", id: "text-1", type: "text-delta" });
      writer.write({ id: "text-1", type: "text-end" });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
  });

  return createUIMessageStreamResponse({ stream });
};

describe("ChatView", () => {
  it("should send the server-issued conversationId on the second turn", async () => {
    const requestBodies: unknown[] = [];

    let callCount = 0;

    server.use(
      http.post("/api/chat", async ({ request }) => {
        callCount += 1;
        requestBodies.push(await request.json());

        if (callCount === 1) {
          return buildStreamResponse({ conversationId: "conv-new", messageId: "m-1" });
        }

        return buildStreamResponse({ messageId: "m-2" });
      }),
    );

    const user = userEvent.setup();

    render(
      <ConversationsProvider>
        <ChatView
          agentId="agent-1"
          agentName="Agent One"
          conversationId={null}
          initialMessages={[]}
          modelId="gpt-test"
          suggestions={[]}
        />
      </ConversationsProvider>,
    );

    const textarea = screen.getByPlaceholderText("message...");

    await user.type(textarea, "first");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByLabelText("message m-1")).toBeInTheDocument();
    });

    await user.type(textarea, "second");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(requestBodies).toHaveLength(2);
    });

    expect(requestBodies[0]).toMatchObject({ agentId: "agent-1", conversationId: null });
    expect(requestBodies[1]).toMatchObject({ agentId: "agent-1", conversationId: "conv-new" });
  });
});
