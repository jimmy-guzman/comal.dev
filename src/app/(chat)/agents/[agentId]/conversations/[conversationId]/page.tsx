import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ChatView } from "@/components/chat-view";
import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { projectMessages } from "@/lib/chat/projector";
import { getConversationWithEvents } from "@/lib/chat/store";

async function fetchAgentDetail(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(
    getAgentForUser(agentId, userId).pipe(Effect.catchAll(() => {
      return Effect.succeed(null);
    })),
  );
}

interface Props {
  params: Promise<{ agentId: string; conversationId: string }>;
}

export default async function ConversationPage({ params }: Props) {
  const { agentId, conversationId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) notFound();

  const [agent, conv] = await Promise.all([
    fetchAgentDetail(agentId, session.user.id),
    appRuntime.runPromise(
      getConversationWithEvents(session.user.id, conversationId).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      ),
    ),
  ]);

  if (!agent) notFound();

  if (!conv) notFound();

  const initialMessages = projectMessages(conv.events);

  return (
    <ChatView
      agentId={agentId}
      agentName={agent.name}
      conversationId={conversationId}
      initialMessages={initialMessages}
      modelId={conv.modelId}
      suggestions={[]}
    />
  );
}
