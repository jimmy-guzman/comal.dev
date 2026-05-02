import { Effect } from "effect";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{agent.name}</h1>
          <p className="text-muted-foreground text-sm">{agent.description ?? "No description"}</p>
        </div>
        <div className="flex items-center gap-2">
          <DeleteAgentButton
            agentId={agentId}
            agentName={agent.name}
            trigger={
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Delete agent"
                    className="aspect-square px-0 sm:aspect-auto sm:px-2.5"
                    variant="outline"
                  >
                    <Trash2Icon />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            }
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Edit agent"
                asChild
                className="aspect-square px-0 sm:aspect-auto sm:px-2.5"
                variant="outline"
              >
                <Link href={`/agents/${agentId}/edit`}>
                  <PencilIcon />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="New conversation"
                asChild
                className="aspect-square px-0 sm:aspect-auto sm:px-2.5"
              >
                <Link href={`/agents/${agentId}/conversations/new`}>
                  <PlusIcon />
                  <span className="hidden sm:inline">New conversation</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>New conversation</TooltipContent>
          </Tooltip>
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
