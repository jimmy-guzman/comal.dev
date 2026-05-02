import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ChatView } from "@/components/chat-view";
import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { projectMessages } from "@/lib/chat/projector";
import { getConversationWithEvents } from "@/lib/chat/store";

interface Props {
  params: Promise<{ agentId: string; conversationId: string }>;
}

export default async function ConversationPage({ params }: Props) {
  const { agentId, conversationId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) notFound();

  const agentEffect = getAgentForUser(agentId, session.user.id).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
  );

  const agent = await appRuntime.runPromise(agentEffect);

  if (!agent) notFound();

  const conv = await appRuntime.runPromise(
    getConversationWithEvents(session.user.id, conversationId).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    ),
  );

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
