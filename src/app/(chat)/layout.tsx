import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ConversationsProvider } from "@/components/conversations-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { appRuntime } from "@/db/service";
import { listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { listRecentConversationsForUser } from "@/lib/chat";

async function fetchSidebarAgents(userId: string) {
  "use cache";

  cacheTag(`agents:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(listAgentsForUser(userId));
}

async function fetchSidebarConversations(userId: string) {
  "use cache";

  cacheTag(`conversations:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(listRecentConversationsForUser(userId, 20));
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isSignedIn = Boolean(session?.user) && !session?.user.isAnonymous;

  const [agents, conversations] = session?.user
    ? await Promise.all([
        fetchSidebarAgents(session.user.id),
        fetchSidebarConversations(session.user.id),
      ])
    : [[], []];

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
      {children}
    </ConversationsProvider>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <Suspense>
        <SidebarShell>
          <SidebarInset>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
            </header>
            {children}
          </SidebarInset>
        </SidebarShell>
      </Suspense>
    </SidebarProvider>
  );
}
