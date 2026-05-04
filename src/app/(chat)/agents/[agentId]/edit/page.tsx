import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AgentForm } from "@/components/agent-form";
import { appRuntime } from "@/db/service";
import { getAgentForUser, listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function EditAgentPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, ownedAgents] = await appRuntime.runPromise(
    Effect.all([
      getAgentForUser(agentId, session.user.id).pipe(
        Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
      ),
      listAgentsForUser(session.user.id),
    ]),
  );

  if (!agent) notFound();

  if (agent.isSystem) redirect(`/agents/${agentId}`);

  return (
    <div className="pb-safe-or-8 px-safe-or-4 sm:px-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain py-4 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">edit agent</h1>
        <p className="text-muted-foreground text-sm">{agent.name}</p>
      </div>
      <AgentForm
        initialAgent={{
          defaultModelId: agent.defaultModelId,
          description: agent.description,
          id: agent.id,
          name: agent.name,
          subAgents: agent.subAgents,
          systemPrompt: agent.systemPrompt,
          tools: agent.tools,
        }}
        ownedAgents={ownedAgents}
      />
    </div>
  );
}
