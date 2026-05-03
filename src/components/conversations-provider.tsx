"use client";

import { useCallback, useMemo, useState } from "react";

import type { RecentConversation } from "@/components/conversations-context";

import { ConversationsContext } from "@/components/conversations-context";

const DEFAULT_INITIAL: RecentConversation[] = [];

interface Props {
  children: React.ReactNode;
  initial?: RecentConversation[];
}

export const ConversationsProvider = ({ children, initial = DEFAULT_INITIAL }: Props) => {
  const [conversations, setConversations] = useState<RecentConversation[]>(initial);

  const seedConversations = useCallback((next: RecentConversation[]) => {
    setConversations(next);
  }, []);

  const prependConversation = useCallback((conversation: RecentConversation) => {
    setConversations((current) => {
      if (current.some((c) => c.id === conversation.id)) return current;

      return [conversation, ...current];
    });
  }, []);

  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations((current) => {
      return current.map((c) => (c.id === id ? { ...c, title } : c));
    });
  }, []);

  const value = useMemo(() => {
    return { conversations, prependConversation, seedConversations, updateConversationTitle };
  }, [conversations, prependConversation, seedConversations, updateConversationTitle]);

  return <ConversationsContext value={value}>{children}</ConversationsContext>;
};
