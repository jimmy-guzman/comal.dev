import type { SearchParams } from "nuqs/server";

import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { chatSearchParamsCache } from "@/app/(chat)/chats/search-params";
import { ChatView } from "@/components/chat-view";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { ModelPricingService } from "@/lib/model-pricing";

async function fetchAgents(userId: string) {
  "use cache";

  cacheTag(`agents:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(AgentService.listForUser(userId));
}

async function fetchAgent(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(
    AgentService.getForUser(agentId, userId).pipe(
      Effect.catchTag("AgentNotFoundError", () => Effect.succeed(null)),
    ),
  );
}

async function fetchModelOutputCosts() {
  "use cache";

  cacheTag("model-pricing");
  cacheLife("hours");

  return appRuntime.runPromise(ModelPricingService.listOutputCosts());
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function NewChatPage({ searchParams }: Props) {
  const { agent: agentParam } = await chatSearchParamsCache.parse(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agents, modelOutputCosts] = await Promise.all([
    fetchAgents(session.user.id),
    fetchModelOutputCosts(),
  ]);

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
      modelOutputCosts={modelOutputCosts}
      suggestions={resolvedAgent.suggestions}
    />
  );
}
