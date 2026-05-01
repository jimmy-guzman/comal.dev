import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ChatView } from "@/components/chat-view";
import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function NewConversationPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agent = await appRuntime.runPromise(
    getAgentForUser(agentId, session.user.id).pipe(
      Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
    ),
  );

  if (!agent) notFound();

  return (
    <ChatView
      agentId={agentId}
      agentName={agent.name}
      conversationId={null}
      initialMessages={[]}
      modelId={agent.defaultModelId}
      suggestions={[]}
    />
  );
}
