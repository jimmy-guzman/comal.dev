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
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";

const DIVISIONS = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.345_24, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" },
] as const satisfies readonly { amount: number; name: Intl.RelativeTimeFormatUnit }[];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const formatRelative = (date: Date) => {
  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.name);
    }

    duration /= division.amount;
  }

  return relativeTimeFormatter.format(Math.round(duration), "years");
};

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
    <Item asChild>
      <Link href={href}>
        <ItemContent>
          <ItemTitle>{conversation.title ?? "Untitled"}</ItemTitle>
          <ItemDescription>Last message {formatRelative(conversation.createdAt)}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="More options"
                className="hover:bg-background"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                size="icon-sm"
                variant="ghost"
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
                variant="destructive"
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
      </Link>
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
      {conversations.map((c, i) => {
        return (
          <React.Fragment key={c.id}>
            {i > 0 ? <ItemSeparator /> : null}
            <ConversationListItem agentId={agentId} conversation={c} />
          </React.Fragment>
        );
      })}
    </ItemGroup>
  );
};
