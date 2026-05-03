"use client";

import { useEffect } from "react";

import type { RecentConversation } from "@/components/conversations-context";

import { useConversations } from "@/hooks/use-conversations";

interface Props {
  conversations: RecentConversation[];
}

export const ConversationsSeed = ({ conversations }: Props) => {
  const { seedConversations } = useConversations();

  useEffect(() => {
    seedConversations(conversations);
  }, [conversations, seedConversations]);

  return null;
};
