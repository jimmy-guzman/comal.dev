"use client";

import { ChevronRightIcon, MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import type { AgentConfig } from "@/agents/types";

import { DeleteConversationButton } from "@/components/delete-conversation-button";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface Conversation {
  id: string;
  title: null | string;
}

interface AgentWithConversations extends Pick<AgentConfig, "id" | "name"> {
  conversations: Conversation[];
}

interface Props {
  agents: AgentWithConversations[];
  isSignedIn: boolean;
}

interface ConversationItemProps {
  agentId: string;
  conversationId: string;
  isActive: boolean;
  title: null | string;
}

const ConversationItem = ({ agentId, conversationId, isActive, title }: ConversationItemProps) => {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const href = `/agents/${agentId}/conversations/${conversationId}` as const;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={href}>
          <span className="truncate">{title ?? "Untitled"}</span>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <SidebarMenuAction asChild showOnHover>
          <DropdownMenuTrigger>
            <MoreHorizontalIcon />
            <span className="sr-only">More options</span>
          </DropdownMenuTrigger>
        </SidebarMenuAction>
        <DropdownMenuContent align="start" side="right">
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
        conversationId={conversationId}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        redirectAfter={isActive}
      />
    </SidebarMenuItem>
  );
};

export const AppSidebar = ({ agents, isSignedIn }: Props) => {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-1 py-1">
          <Link className="flex items-center gap-2" href="/">
            <Image alt="comal.dev mascot" height={32} src="/mascot.svg" width={32} />
            <span className="text-sm font-semibold">comal.dev</span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {agents.map((agent) => {
          return (
            <Collapsible className="group/collapsible" defaultOpen key={agent.id}>
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center pr-8">
                    {agent.name}
                    <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>

                <SidebarGroupAction asChild title={`New ${agent.name} conversation`}>
                  <Link href={`/agents/${agent.id}/conversations/new`}>
                    <PlusIcon />
                  </Link>
                </SidebarGroupAction>

                <CollapsibleContent>
                  <SidebarMenu>
                    {agent.conversations.length === 0 ? (
                      <p className="text-muted-foreground px-2 py-2 text-xs">
                        No conversations yet.
                      </p>
                    ) : (
                      agent.conversations.map((c) => {
                        const href = `/agents/${agent.id}/conversations/${c.id}` as const;
                        const isActive = pathname === href;

                        return (
                          <ConversationItem
                            agentId={agent.id}
                            conversationId={c.id}
                            isActive={isActive}
                            key={c.id}
                            title={c.title}
                          />
                        );
                      })
                    )}
                  </SidebarMenu>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      {isSignedIn ? null : (
        <SidebarFooter>
          <Button asChild className="w-full" size="sm" variant="outline">
            <Link href="/sign-in">Sign in to save history</Link>
          </Button>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
};
