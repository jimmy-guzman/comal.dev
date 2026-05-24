import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AgentPicker } from "@/components/agent-picker";
import { AgentSectionDirectory } from "@/components/agent-section-directory";
import { ConversationList } from "@/components/conversation-list";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import { getModelCostLabel } from "@/config/models";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { ChatService } from "@/lib/chat";

async function fetchAgentDetail(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(
    AgentService.getForUser(agentId, userId).pipe(
      Effect.catchTag("AgentNotFoundError", () => Effect.succeed(null)),
    ),
  );
}

async function fetchVersionCount(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  const versions = await appRuntime.runPromise(AgentService.listVersions(agentId, userId));

  return versions.length;
}

async function fetchRecentChats(agentId: string, userId: string) {
  "use cache";

  cacheTag(`conversations:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(ChatService.listForAgent(userId, agentId));
}

async function fetchUserAgents(userId: string) {
  "use cache";

  cacheTag(`agents:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(AgentService.listForUser(userId));
}

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentOverviewPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, versionCount, recentChats, agents] = await Promise.all([
    fetchAgentDetail(agentId, session.user.id),
    fetchVersionCount(agentId, session.user.id),
    fetchRecentChats(agentId, session.user.id),
    fetchUserAgents(session.user.id),
  ]);

  if (!agent) notFound();

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 text-2xl font-semibold sm:text-3xl">
            <AgentPicker
              agentId={agentId}
              agentName={agent.name}
              agents={agents.map((a) => ({ id: a.id, name: a.name }))}
              isSystem={agent.isSystem}
            />
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a download href={`/api/agents/${agentId}/export`}>
                export
              </a>
            </Button>
            <Button asChild size="sm">
              <Link href={`/chats/new?agent=${agentId}`}>new chat</Link>
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">{agent.description ?? "no description"}</p>
      </div>

      <ItemGroup className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">model</p>
            <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <span className="truncate">
                {agent.defaultModelId.split("/").at(-1) ?? agent.defaultModelId}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tracking-tight">
                {getModelCostLabel(agent.defaultModelId)}
              </span>
            </p>
          </ItemContent>
        </Item>
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">tools</p>
            <p className="text-sm font-medium">{agent.tools.length}</p>
          </ItemContent>
        </Item>
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">sub-agents</p>
            <p className="text-sm font-medium">{agent.subAgents.length}</p>
          </ItemContent>
        </Item>
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">evals</p>
            <p className="text-sm font-medium">{agent.evals.length}</p>
          </ItemContent>
        </Item>
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">versions</p>
            <p className="text-sm font-medium">{versionCount}</p>
          </ItemContent>
        </Item>
        <Item className="h-full px-4 py-4" variant="outline">
          <ItemContent>
            <p className="text-muted-foreground text-xs">chats</p>
            <p className="text-sm font-medium">{recentChats.length}</p>
          </ItemContent>
        </Item>
      </ItemGroup>

      <AgentSectionDirectory agentId={agentId} isSystem={agent.isSystem} />

      {recentChats.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">recent chats</h2>
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
