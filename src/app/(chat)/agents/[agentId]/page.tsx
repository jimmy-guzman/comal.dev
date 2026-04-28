import { Effect } from "effect";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConversationList } from "@/components/conversation-list";
import { DeleteAgentButton } from "@/components/delete-agent-button";
import { Button } from "@/components/ui/button";
import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { listConversationsForAgent } from "@/lib/chat";

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agent = await appRuntime.runPromise(
    getAgentForUser(agentId, session.user.id).pipe(
      Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
    ),
  );

  if (!agent) notFound();

  const conversations = await appRuntime.runPromise(
    listConversationsForAgent(session.user.id, agentId),
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{agent.name}</h1>
          <p className="text-muted-foreground text-sm">{agent.description ?? "No description"}</p>
        </div>
        <div className="flex gap-2">
          <DeleteAgentButton agentId={agentId} agentName={agent.name} />
          <Button asChild variant="outline">
            <Link href={`/agents/${agentId}/edit`}>Edit</Link>
          </Button>
          <Button asChild>
            <Link href={`/agents/${agentId}/conversations/new`}>New conversation</Link>
          </Button>
        </div>
      </div>

      {conversations.length === 0 ? (
        <p className="text-muted-foreground text-sm">No conversations yet. Start one above.</p>
      ) : (
        <ConversationList agentId={agentId} conversations={conversations} />
      )}
    </div>
  );
}
