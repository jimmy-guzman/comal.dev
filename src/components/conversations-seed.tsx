"use client";

import { useState } from "react";

import type { RecentConversation } from "@/components/conversations-context";

import { useConversations } from "@/hooks/use-conversations";

interface Props {
  conversations: RecentConversation[];
}

export const ConversationsSeed = ({ conversations }: Props) => {
  const { seedConversations } = useConversations();
  const [previous, setPrevious] = useState<null | RecentConversation[]>(null);

  if (conversations !== previous) {
    setPrevious(conversations);
    seedConversations(conversations);
  }

  return null;
};
