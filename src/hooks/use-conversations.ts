"use client";

import { use } from "react";

import { ConversationsContext } from "@/components/conversations-context";

export const useConversations = () => {
  const value = use(ConversationsContext);

  if (value === null) {
    throw new Error("useConversations must be used within a ConversationsProvider");
  }

  return value;
};
