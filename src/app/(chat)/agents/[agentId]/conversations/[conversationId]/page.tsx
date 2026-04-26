import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getAgent } from "@/agents";
import { ChatView } from "@/components/chat-view";
import { DatabaseLive } from "@/db/service";
import { auth } from "@/lib/auth";
import { getConversationWithMessages, parseStoredMessages } from "@/lib/chat";

interface Props {
  params: Promise<{ agentId: string; conversationId: string }>;
}

export default async function ConversationPage({ params }: Props) {
  const { agentId, conversationId } = await params;

  const agent = getAgent(agentId);

  if (!agent) notFound();

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) notFound();

  const conv = await Effect.runPromise(
    getConversationWithMessages(session.user.id, conversationId).pipe(
      Effect.provide(DatabaseLive),
      Effect.catchAll(() => Effect.succeed(null)),
    ),
  );

  if (!conv) notFound();

  const initialMessages = parseStoredMessages(conv.messages);

  return (
    <ChatView
      agentId={agentId}
      conversationId={conversationId}
      initialMessages={initialMessages}
      modelId={conv.modelId}
      suggestions={agent.suggestions ?? []}
    />
  );
}
