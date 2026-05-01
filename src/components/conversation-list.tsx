"use client";

import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { DeleteConversationButton } from "@/components/delete-conversation-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";

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
  const href = `/agents/${agentId}/conversations/${conversation.id}` as const;

  return (
    <Item>
      <ItemContent>
        <ItemTitle>
          <Link href={href}>{conversation.title ?? "Untitled"}</Link>
        </ItemTitle>
        <ItemDescription>{conversation.createdAt.toLocaleDateString()}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="More options" size="icon-sm" variant="ghost">
              <MoreHorizontalIcon />
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
      </ItemActions>
    </Item>
  );
};

interface Props {
  agentId: string;
  conversations: Conversation[];
}

export const ConversationList = ({ agentId, conversations }: Props) => {
  return (
    <ItemGroup>
      {conversations.map((c) => {
        return <ConversationListItem agentId={agentId} conversation={c} key={c.id} />;
      })}
    </ItemGroup>
  );
};
