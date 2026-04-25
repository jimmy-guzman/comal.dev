import { headers } from "next/headers";

import { AGENTS } from "@/agents";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { runWithDb } from "@/db/service";
import { auth } from "@/lib/auth";
import { listConversationsForAgent } from "@/lib/chat";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isSignedIn = Boolean(session?.user) && !session?.user.isAnonymous;

  const agentsWithConversations = await Promise.all(
    AGENTS.map(async (agent) => {
      return {
        conversations: session?.user
          ? await runWithDb(listConversationsForAgent(session.user.id, agent.id))
          : [],
        id: agent.id,
        name: agent.name,
      };
    }),
  );

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar agents={agentsWithConversations} isSignedIn={isSignedIn} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
