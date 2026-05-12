"use client";

import { MoreHorizontalIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useLayoutEffect } from "react";

import { DeleteConversationButton } from "@/components/delete-conversation-button";
import { NewChatButton } from "@/components/new-chat-button";
import { Button } from "@/components/ui/button";
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useConversations } from "@/hooks/use-conversations";

interface Props {
  agents: { id: string; name: string }[];
  isSignedIn: boolean;
}

interface ConversationItemProps {
  agentName: string;
  conversationId: string;
  isActive: boolean;
  title: string;
}

const ConversationItem = ({
  agentName,
  conversationId,
  isActive,
  title,
}: ConversationItemProps) => {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const href = `/chats/${conversationId}` as const;

  useLayoutEffect(() => {
    return () => {
      setDeleteOpen(false);
    };
  }, []);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className="h-auto py-2" isActive={isActive}>
        <Link href={href}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm">{title}</span>
            <span className="text-muted-foreground truncate text-xs">{agentName}</span>
          </div>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <SidebarMenuAction asChild showOnHover>
          <DropdownMenuTrigger>
            <MoreHorizontalIcon />
            <span className="sr-only">more options</span>
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
            delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteConversationButton
        conversationId={conversationId}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        redirectAfter={isActive}
      />
    </SidebarMenuItem>
  );
};

export const AppSidebar = ({ agents, isSignedIn }: Props) => {
  const { conversations } = useConversations();
  const pathname = usePathname();
  const activeMatch = /^\/chats\/([^/]+)/.exec(pathname);
  const activeConversationId = activeMatch?.[1] ?? null;

  const mostRecentAgentId = agents.at(0)?.id ?? null;

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
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <NewChatButton agentId={mostRecentAgentId} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/chats"}>
                <Link href="/chats">chats</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/agents") && activeMatch === null}
              >
                <Link href="/agents">agents</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/tools" || pathname.startsWith("/tools/")}
              >
                <Link href="/tools">tools</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>RECENT</SidebarGroupLabel>
          <SidebarMenu>
            {conversations.length === 0 ? (
              <p className="text-muted-foreground px-2 py-2 text-xs">no chats yet.</p>
            ) : (
              conversations.map((c) => {
                return (
                  <ConversationItem
                    agentName={c.agentName}
                    conversationId={c.id}
                    isActive={c.id === activeConversationId}
                    key={c.id}
                    title={c.title}
                  />
                );
              })
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {isSignedIn ? null : (
        <SidebarFooter>
          <Button asChild className="w-full" size="sm" variant="outline">
            <Link href="/sign-in">sign in to save history</Link>
          </Button>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
};
