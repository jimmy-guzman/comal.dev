"use client";

import { useSelectedLayoutSegment } from "next/navigation";

export default function AgentLayout({
  conversation,
  detail,
}: {
  conversation: React.ReactNode;
  detail: React.ReactNode;
}) {
  const conversationSegment = useSelectedLayoutSegment("conversation");

  return conversationSegment ? conversation : detail;
}
