import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { AppUIMessage } from "@/lib/app-ui-message";

import { ChatView } from "@/components/chat-view";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { projectMessages, projectSubagentTraces } from "@/lib/chat/projector";
import { ChatStoreService } from "@/lib/chat/store";
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
  params: Promise<{ conversationId: string }>;
}

export default async function ChatPage({ params }: Props) {
  const { conversationId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) notFound();

  const conv = await appRuntime.runPromise(
    ChatStoreService.getConversationWithEvents(session.user.id, conversationId).pipe(
      Effect.catchTag("ConversationNotFoundError", () => Effect.succeed(null)),
      Effect.catchTag("ForbiddenError", () => Effect.succeed(null)),
    ),
  );

  if (!conv) notFound();

  if (conv.kind === "eval") redirect(`/chats/${conversationId}/trace`);

  const [agents, agent, modelOutputCosts] = await Promise.all([
    fetchAgents(session.user.id),
    fetchAgent(conv.agentId, session.user.id),
    fetchModelOutputCosts(),
  ]);

  const resolvedAgent = agent ?? agents[0];

  const topLevelEvents = conv.events.filter((e) => e.parentToolCallId === null);
  const initialMessages = projectMessages(topLevelEvents);
  const subagentTraces = projectSubagentTraces(conv.events);

  return (
    <ChatView
      agentId={resolvedAgent.id}
      agentName={resolvedAgent.name}
      agents={agents.map((a) => {
        return { id: a.id, isSystem: a.isSystem, name: a.name };
      })}
      conversationId={conversationId}
      initialMessages={initialMessages as AppUIMessage[]}
      modelId={conv.modelId}
      modelOutputCosts={modelOutputCosts}
      subagentTraces={subagentTraces}
      suggestions={resolvedAgent.suggestions}
    />
  );
}
