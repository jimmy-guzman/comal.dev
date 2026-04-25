import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAgent } from "@/agents";
import { Button } from "@/components/ui/button";
import { runWithDb } from "@/db/service";
import { auth } from "@/lib/auth";
import { listConversationsForAgent } from "@/lib/chat";

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { agentId } = await params;

  const agent = getAgent(agentId);

  if (!agent) notFound();

  const session = await auth.api.getSession({ headers: await headers() });

  const conversations = session?.user
    ? await runWithDb(listConversationsForAgent(session.user.id, agentId))
    : [];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{agent.name}</h1>
          <p className="text-muted-foreground text-sm">{agent.description}</p>
        </div>
        <Button asChild>
          <Link href={`/agents/${agentId}/conversations/new`}>New conversation</Link>
        </Button>
      </div>

      {conversations.length === 0 ? (
        <p className="text-muted-foreground text-sm">No conversations yet. Start one above.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {conversations.map((c) => {
            return (
              <li key={c.id}>
                <Link
                  className="hover:bg-accent flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors"
                  href={`/agents/${agentId}/conversations/${c.id}`}
                >
                  <span className="truncate">{c.title ?? "Untitled"}</span>
                  <span className="text-muted-foreground ml-4 shrink-0 text-xs">
                    {c.createdAt.toLocaleDateString()}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
