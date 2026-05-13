"use client";

import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useLayoutEffect } from "react";

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
  agentName?: string;
  createdAt: Date;
  id: string;
  title: null | string;
}

interface ConversationListItemProps {
  conversation: Conversation;
}

const ConversationListItem = ({ conversation }: ConversationListItemProps) => {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const href = `/chats/${conversation.id}` as const;

  useLayoutEffect(() => {
    return () => {
      setDeleteOpen(false);
    };
  }, []);

  return (
    <Item className="flex h-full min-h-0 flex-col flex-nowrap items-stretch" variant="outline">
      <div className="flex min-h-0 flex-1 gap-2">
        <ItemContent className="relative min-h-0 min-w-0 flex-1">
          <Link
            className="relative flex min-h-0 flex-col gap-1 outline-none after:absolute after:inset-0 after:z-0 after:content-['']"
            href={href}
          >
            <ItemTitle>{conversation.title ?? "untitled"}</ItemTitle>
            <ItemDescription>
              {conversation.agentName === undefined ? null : `${conversation.agentName} · `}
              {formatRelative(conversation.createdAt)}
            </ItemDescription>
          </Link>
        </ItemContent>
        <ItemActions className="relative z-10 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="more options" size="icon-sm" variant="ghost">
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
                delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DeleteConversationButton
            conversationId={conversation.id}
            onOpenChange={setDeleteOpen}
            open={deleteOpen}
          />
        </ItemActions>
      </div>
    </Item>
  );
};

interface Props {
  conversations: Conversation[];
}

export const ConversationList = ({ conversations }: Props) => {
  return (
    <ItemGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {conversations.map((c) => {
        return <ConversationListItem conversation={c} key={c.id} />;
      })}
    </ItemGroup>
  );
};
