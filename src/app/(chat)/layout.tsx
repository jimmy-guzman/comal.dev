import { headers } from "next/headers";

import { AGENTS } from "@/agents";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { listConversationsForAgent } from "@/lib/chat";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isSignedIn = !!session?.user && !session.user.isAnonymous;

  const agentsWithConversations = await Promise.all(
    AGENTS.map(async (agent) => ({
      id: agent.id,
      name: agent.name,
      conversations: session?.user
        ? await listConversationsForAgent(session.user.id, agent.id)
        : [],
    })),
  );

  return (
    <SidebarProvider>
      <AppSidebar agents={agentsWithConversations} isSignedIn={isSignedIn} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
