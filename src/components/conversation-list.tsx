"use client";

import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { DeleteConversationButton } from "@/components/delete-conversation-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Conversation {
  createdAt: Date;
  id: string;
  title: null | string;
}

interface ConversationListItemProps {
  agentId: string;
  conversation: Conversation;
}

const ConversationListItem = ({ agentId, conversation }: ConversationListItemProps) => {
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <li className="group flex items-center" key={conversation.id}>
      <a
        className="hover:bg-accent flex flex-1 items-center gap-4 rounded-md px-3 py-2 text-sm transition-colors"
        href={`/agents/${agentId}/conversations/${conversation.id}`}
      >
        <span className="truncate">{conversation.title ?? "Untitled"}</span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
          {conversation.createdAt.toLocaleDateString()}
        </span>
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="text-muted-foreground hover:text-foreground ml-1 transition-opacity group-hover:opacity-100 md:opacity-0"
            size="icon-sm"
            variant="ghost"
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteConversationButton
        agentId={agentId}
        conversationId={conversation.id}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </li>
  );
};

interface Props {
  agentId: string;
  conversations: Conversation[];
}

export const ConversationList = ({ agentId, conversations }: Props) => {
  return (
    <ul className="flex flex-col gap-1">
      {conversations.map((c) => {
        return <ConversationListItem agentId={agentId} conversation={c} key={c.id} />;
      })}
    </ul>
  );
};
