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
import { Separator } from "@/components/ui/separator";

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
    <li className="group/row relative">
      <Link className="hover:bg-muted flex flex-col gap-1 rounded-md px-3 py-2.5" href={href}>
        <span className="truncate text-xs font-medium">{conversation.title ?? "Untitled"}</span>
        <span className="text-muted-foreground truncate text-xs/relaxed">
          Last message {formatRelative(conversation.createdAt)}
        </span>
      </Link>
      <div className="absolute top-1/2 right-2 -translate-y-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="More options"
              className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
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
      </div>
    </li>
  );
};

interface Props {
  agentId: string;
  conversations: Conversation[];
}

export const ConversationList = ({ agentId, conversations }: Props) => {
  return (
    <ul className="flex flex-col">
      {conversations.map((c, i) => {
        return (
          <React.Fragment key={c.id}>
            {i > 0 ? <Separator /> : null}
            <ConversationListItem agentId={agentId} conversation={c} />
          </React.Fragment>
        );
      })}
    </ul>
  );
};
