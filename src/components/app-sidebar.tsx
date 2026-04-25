"use client";

import { ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AgentConfig } from "@/agents/types";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

interface Conversation {
  id: string;
  title: string;
}

interface AgentWithConversations extends Pick<AgentConfig, "id" | "name"> {
  conversations: Conversation[];
}

interface Props {
  agents: AgentWithConversations[];
  isSignedIn: boolean;
}

export const AppSidebar = ({ agents, isSignedIn }: Props) => {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-1 py-1">
          <Link href="/" className="text-sm font-semibold">
            comal.dev
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {agents.map((agent) => (
          <Collapsible key={agent.id} defaultOpen className="group/collapsible">
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
                    <p className="text-muted-foreground px-2 py-2 text-xs">No conversations yet.</p>
                  ) : (
                    agent.conversations.map((c) => {
                      const href = `/agents/${agent.id}/conversations/${c.id}` as const;
                      return (
                        <SidebarMenuItem key={c.id}>
                          <SidebarMenuButton asChild isActive={pathname === href}>
                            <Link href={href}>
                              <span className="truncate">{c.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })
                  )}
                </SidebarMenu>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      {isSignedIn ? null : (
        <SidebarFooter>
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link href="/sign-in">Sign in to save history</Link>
          </Button>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
};
