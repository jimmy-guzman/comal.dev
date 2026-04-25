import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getAgent } from "@/agents";
import { ChatView } from "@/components/chat-view";
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

  const conv = await getConversationWithMessages(session.user.id, conversationId);

  if (!conv) notFound();

  const initialMessages = parseStoredMessages(conv.messages);

  return (
    <ChatView
      conversationId={conversationId}
      initialMessages={initialMessages}
      modelId={conv.modelId}
      agentId={agentId}
    />
  );
}
