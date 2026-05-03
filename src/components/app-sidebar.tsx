"use client";

import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
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
  agentId: string;
  agentName: string;
  conversationId: string;
  isActive: boolean;
  title: string;
}

const ConversationItem = ({
  agentId,
  agentName,
  conversationId,
  isActive,
  title,
}: ConversationItemProps) => {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const href = `/agents/${agentId}/conversations/${conversationId}` as const;

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
            <Trash2Icon />
            delete
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
  const { conversations } = useConversations();
  const pathname = usePathname();
  const activeMatch = /^\/agents\/[^/]+\/conversations\/([^/]+)/.exec(pathname);
  const activeConversationId = activeMatch?.[1] ?? null;
  const isOnConversation = activeMatch !== null;

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
              <NewChatButton agents={agents} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>recent</SidebarGroupLabel>
          <SidebarMenu>
            {conversations.length === 0 ? (
              <p className="text-muted-foreground px-2 py-2 text-xs">No chats yet.</p>
            ) : (
              conversations.map((c) => {
                return (
                  <ConversationItem
                    agentId={c.agentId}
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

        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/agents") && !isOnConversation}
              >
                <Link href="/agents">agents</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
