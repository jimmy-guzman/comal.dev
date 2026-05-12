import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AgentSubagentsForm } from "@/components/agent-subagents-form";
import { appRuntime } from "@/db/service";
import { getAgentForUser, listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";

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

async function fetchOwnedAgents(userId: string) {
  "use cache";

  cacheTag(`agents:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(listAgentsForUser(userId));
}

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentSubAgentsPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, ownedAgents] = await Promise.all([
    fetchAgent(agentId, session.user.id),
    fetchOwnedAgents(session.user.id),
  ]);

  if (!agent) notFound();

  if (agent.isSystem) redirect(`/agents/${agentId}`);

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">sub-agents</h2>
        <p className="text-muted-foreground text-sm">
          other agents this agent can delegate tasks to.
        </p>
      </div>
      <AgentSubagentsForm
        agentId={agentId}
        initialSubAgents={agent.subAgents}
        ownedAgents={ownedAgents.filter((a) => a.id !== agentId)}
      />
    </div>
  );
}
