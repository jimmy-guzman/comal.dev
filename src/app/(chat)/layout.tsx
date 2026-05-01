import { Effect } from "effect";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ConversationsProvider } from "@/components/conversations-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { appRuntime } from "@/db/service";
import { listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { listRecentConversationsForUser } from "@/lib/chat";

const SidebarSkeleton = () => {
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
              <Skeleton className="mx-2 h-8 rounded-md" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarMenu>
            {Array.from({ length: 5 }, (_, i) => {
              return (
                <SidebarMenuItem key={i}>
                  <div className="flex h-auto flex-col gap-1 px-2 py-2">
                    <Skeleton className="h-3.5 rounded-md" style={{ width: `${60 + i * 6}%` }} />
                    <Skeleton className="h-3 w-1/3 rounded-md" />
                  </div>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
};

const ChatSidebarData = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  const isSignedIn = Boolean(session?.user) && !session?.user.isAnonymous;

  const { agents, conversations } = session?.user
    ? await appRuntime.runPromise(
        Effect.all(
          {
            agents: listAgentsForUser(session.user.id),
            conversations: listRecentConversationsForUser(session.user.id, 20),
          },
          { concurrency: "unbounded" },
        ),
      )
    : { agents: [], conversations: [] };

  const initialConversations = conversations.map((c) => {
    return {
      agentId: c.agentId,
      agentName: c.agentName,
      id: c.id,
      title: c.title,
    };
  });

  return (
    <ConversationsProvider initial={initialConversations}>
      <AppSidebar
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        isSignedIn={isSignedIn}
      />
    </ConversationsProvider>
  );
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <Suspense fallback={<SidebarSkeleton />}>
        <ChatSidebarData />
      </Suspense>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
