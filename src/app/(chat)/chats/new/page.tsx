import type { SearchParams } from "nuqs/server";

import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { chatSearchParamsCache } from "@/app/(chat)/chats/search-params";
import { ChatView } from "@/components/chat-view";
import { appRuntime } from "@/db/service";
import { getAgentForUser, listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";

async function fetchAgents(userId: string) {
  "use cache";

  cacheTag(`agents:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(listAgentsForUser(userId));
}

async function fetchAgent(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(
    getAgentForUser(agentId, userId).pipe(
      Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
    ),
  );
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function NewChatPage({ searchParams }: Props) {
  const { agent: agentParam } = await chatSearchParamsCache.parse(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agents = await fetchAgents(session.user.id);

  if (agents.length === 0) redirect("/");

  const selectedAgentId = agentParam ?? agents[0].id;
  const agent = await fetchAgent(selectedAgentId, session.user.id);

  const resolvedAgent = agent ?? agents[0];

  return (
    <ChatView
      agentId={resolvedAgent.id}
      agentName={resolvedAgent.name}
      agents={agents.map((a) => {
        return { id: a.id, isSystem: a.isSystem, name: a.name };
      })}
      conversationId={null}
      initialMessages={[]}
      modelId={resolvedAgent.defaultModelId}
      suggestions={[]}
    />
  );
}
