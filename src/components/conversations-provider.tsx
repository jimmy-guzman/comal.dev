"use client";

import { useCallback, useMemo, useState } from "react";

import type { RecentConversation } from "@/components/conversations-context";

import { ConversationsContext } from "@/components/conversations-context";

interface Props {
  children: React.ReactNode;
  initial: RecentConversation[];
}

export const ConversationsProvider = ({ children, initial }: Props) => {
  const [conversations, setConversations] = useState(initial);
  const [previousInitial, setPreviousInitial] = useState(initial);

  if (initial !== previousInitial) {
    setPreviousInitial(initial);
    setConversations(initial);
  }

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
    return { conversations, prependConversation, updateConversationTitle };
  }, [conversations, prependConversation, updateConversationTitle]);

  return <ConversationsContext value={value}>{children}</ConversationsContext>;
};
