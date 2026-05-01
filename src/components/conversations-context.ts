"use client";

import { createContext } from "react";

export interface RecentConversation {
  agentId: string;
  agentName: string;
  id: string;
  title: string;
}

interface ConversationsContextValue {
  conversations: RecentConversation[];
  prependConversation: (conversation: RecentConversation) => void;
  updateConversationTitle: (id: string, title: string) => void;
}

export const ConversationsContext = createContext<ConversationsContextValue | null>(null);

ConversationsContext.displayName = "ConversationsContext";
