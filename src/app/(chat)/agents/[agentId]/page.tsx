import { Effect } from "effect";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConversationList } from "@/components/conversation-list";
import { DeleteAgentButton } from "@/components/delete-agent-button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { listConversationsForAgent } from "@/lib/chat";

async function fetchAgentDetail(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(
    getAgentForUser(agentId, userId).pipe(
      Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
    ),
  );
}

async function fetchConversationsForAgent(agentId: string, userId: string) {
  "use cache";

  cacheTag(`conversations:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(listConversationsForAgent(userId, agentId));
}

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, conversations] = await Promise.all([
    fetchAgentDetail(agentId, session.user.id),
    fetchConversationsForAgent(agentId, session.user.id),
  ]);

  if (!agent) notFound();

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{agent.name}</h1>
          <p className="text-muted-foreground text-sm">{agent.description ?? "no description"}</p>
        </div>
        <div className="flex items-center gap-2">
          <DeleteAgentButton
            agentId={agentId}
            agentName={agent.name}
            trigger={
              <Button
                aria-label="delete agent"
                className="aspect-square px-0 sm:aspect-auto sm:px-2.5"
                variant="outline"
              >
                <Trash2Icon />
                <span className="hidden sm:inline">delete</span>
              </Button>
            }
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="edit agent"
                asChild
                className="aspect-square px-0 sm:aspect-auto sm:px-2.5"
                variant="outline"
              >
                <Link href={`/agents/${agentId}/edit`}>
                  <PencilIcon />
                  <span className="hidden sm:inline">edit</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="new conversation"
                asChild
                className="aspect-square px-0 sm:aspect-auto sm:px-2.5"
              >
                <Link href={`/agents/${agentId}/conversations/new`}>
                  <PlusIcon />
                  <span className="hidden sm:inline">new conversation</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>new conversation</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {conversations.length === 0 ? (
        <p className="text-muted-foreground text-sm">no conversations yet. start one above.</p>
      ) : (
        <ConversationList agentId={agentId} conversations={conversations} />
      )}
    </div>
  );
}
