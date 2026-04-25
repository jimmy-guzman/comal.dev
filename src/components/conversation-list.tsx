"use client";

import { Trash2Icon } from "lucide-react";

import { DeleteConversationButton } from "@/components/delete-conversation-button";
import { Button } from "@/components/ui/button";

interface Conversation {
  createdAt: Date;
  id: string;
  title: null | string;
}

interface Props {
  agentId: string;
  conversations: Conversation[];
}

export const ConversationList = ({ agentId, conversations }: Props) => {
  return (
    <ul className="flex flex-col gap-1">
      {conversations.map((c) => {
        return (
          <li className="group flex items-center" key={c.id}>
            <a
              className="hover:bg-accent flex flex-1 items-center gap-4 rounded-md px-3 py-2 text-sm transition-colors"
              href={`/agents/${agentId}/conversations/${c.id}`}
            >
              <span className="truncate">{c.title ?? "Untitled"}</span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs group-hover:hidden">
                {c.createdAt.toLocaleDateString()}
              </span>
            </a>
            <div className="mr-1 opacity-0 transition-opacity group-hover:opacity-100">
              <DeleteConversationButton
                agentId={agentId}
                conversationId={c.id}
                trigger={
                  <Button
                    className="text-muted-foreground hover:text-destructive"
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Trash2Icon />
                    <span className="sr-only">Delete conversation</span>
                  </Button>
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};
