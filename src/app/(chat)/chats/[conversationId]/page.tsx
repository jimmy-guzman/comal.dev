import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ChatView } from "@/components/chat-view";
import { appRuntime } from "@/db/service";
import { getAgentForUser, listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { projectMessages, projectSubagentTraces } from "@/lib/chat/projector";
import { getConversationWithEvents } from "@/lib/chat/store";

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
  params: Promise<{ conversationId: string }>;
}

export default async function ChatPage({ params }: Props) {
  const { conversationId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) notFound();

  const conv = await appRuntime.runPromise(
    getConversationWithEvents(session.user.id, conversationId).pipe(
      Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
    ),
  );

  if (!conv) notFound();

  const [agents, agent] = await Promise.all([
    fetchAgents(session.user.id),
    fetchAgent(conv.agentId, session.user.id),
  ]);

  const resolvedAgent = agent ?? agents[0];

  const initialMessages = projectMessages(conv.events);
  const subagentTraces = projectSubagentTraces(conv.events);

  return (
    <ChatView
      agentId={resolvedAgent.id}
      agentName={resolvedAgent.name}
      agents={agents.map((a) => ({ id: a.id, name: a.name }))}
      conversationId={conversationId}
      initialMessages={initialMessages}
      modelId={conv.modelId}
      subagentTraces={subagentTraces}
      suggestions={[]}
    />
  );
}
