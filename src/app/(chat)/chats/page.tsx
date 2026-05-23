import type { SearchParams } from "nuqs/server";

import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { chatSearchParamsCache } from "@/app/(chat)/chats/search-params";
import { ChatsFilter } from "@/components/chats-filter";
import { ConversationList } from "@/components/conversation-list";
import { Button } from "@/components/ui/button";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { ChatService } from "@/lib/chat";

async function fetchConversations(userId: string) {
  "use cache";

  cacheTag(`conversations:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(ChatService.listRecentForUser(userId, 100));
}

async function fetchAgents(userId: string) {
  "use cache";

  cacheTag(`agents:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(AgentService.listForUser(userId));
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function ChatsPage({ searchParams }: Props) {
  const { agent: agentFilter } = await chatSearchParamsCache.parse(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [conversations, agents] = await Promise.all([
    fetchConversations(session.user.id),
    fetchAgents(session.user.id),
  ]);

  const filtered = conversations.filter((c) => {
    return agentFilter === null || c.agentId === agentFilter;
  });

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">chats</h1>
        <Button asChild size="sm">
          <Link href="/chats/new">new chat</Link>
        </Button>
      </div>

      <ChatsFilter agents={agents.map((a) => ({ id: a.id, name: a.name }))} />

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {agentFilter === null ? "no conversations yet." : "no conversations with this agent."}
        </p>
      ) : (
        <ConversationList
          conversations={filtered.map((c) => {
            return {
              agentName: c.agentName,
              createdAt: c.createdAt,
              id: c.id,
              title: c.title,
            };
          })}
        />
      )}
    </div>
  );
}
