import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ConversationList } from "@/components/conversation-list";
import { Badge } from "@/components/ui/badge";
import { appRuntime } from "@/db/service";
import { getAgentForUser, listAgentVersions } from "@/lib/agents";
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

async function fetchVersionCount(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  const versions = await appRuntime.runPromise(listAgentVersions(agentId, userId));

  return versions.length;
}

async function fetchRecentChats(agentId: string, userId: string) {
  "use cache";

  cacheTag(`conversations:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(listConversationsForAgent(userId, agentId));
}

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentOverviewPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, versionCount, recentChats] = await Promise.all([
    fetchAgentDetail(agentId, session.user.id),
    fetchVersionCount(agentId, session.user.id),
    fetchRecentChats(agentId, session.user.id),
  ]);

  if (!agent) notFound();

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {agent.name}
          {agent.isSystem && <Badge variant="secondary">system</Badge>}
        </h2>
        <p className="text-muted-foreground text-sm">{agent.description ?? "no description"}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground text-xs">model</p>
          <p className="mt-1 truncate text-sm font-medium">
            {agent.defaultModelId.split("/").at(-1) ?? agent.defaultModelId}
          </p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground text-xs">tools</p>
          <p className="mt-1 text-sm font-medium">{agent.tools.length}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground text-xs">sub-agents</p>
          <p className="mt-1 text-sm font-medium">{agent.subAgents.length}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground text-xs">evals</p>
          <p className="mt-1 text-sm font-medium">{agent.evals.length}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground text-xs">versions</p>
          <p className="mt-1 text-sm font-medium">{versionCount}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground text-xs">chats</p>
          <p className="mt-1 text-sm font-medium">{recentChats.length}</p>
        </div>
      </div>

      {recentChats.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">recent chats</h3>
            <Link
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              href={`/chats?agent=${agentId}`}
            >
              view all
            </Link>
          </div>
          <ConversationList
            conversations={recentChats.map((c) => {
              return { createdAt: c.createdAt, id: c.id, title: c.title };
            })}
          />
        </div>
      ) : null}
    </div>
  );
}
