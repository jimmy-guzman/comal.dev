import { headers } from "next/headers";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { runWithDb } from "@/db/service";
import { listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { listRecentConversationsForUser } from "@/lib/chat";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isSignedIn = Boolean(session?.user) && !session?.user.isAnonymous;

  const [agents, conversations] = session?.user
    ? await Promise.all([
        runWithDb(listAgentsForUser(session.user.id)),
        runWithDb(listRecentConversationsForUser(session.user.id, 20)),
      ])
    : [[], []];

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        conversations={conversations}
        isSignedIn={isSignedIn}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
