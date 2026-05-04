import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ChatView } from "@/components/chat-view";
import { appRuntime } from "@/db/service";
import { getAgentForUser, listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function NewConversationPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, allAgents] = await Promise.all([
    appRuntime.runPromise(
      getAgentForUser(agentId, session.user.id).pipe(
        Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
      ),
    ),
    appRuntime.runPromise(listAgentsForUser(session.user.id)),
  ]);

  if (!agent) notFound();

  return (
    <ChatView
      agentId={agentId}
      agentName={agent.name}
      agents={allAgents.map((a) => ({ id: a.id, name: a.name }))}
      conversationId={null}
      initialMessages={[]}
      modelId={agent.defaultModelId}
      suggestions={[]}
    />
  );
}
