import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { Scorer } from "@/lib/eval-input-schema";

import { AgentForm } from "@/components/agent-form";
import { AgentVersionHistory } from "@/components/agent-version-history";
import { appRuntime } from "@/db/service";
import { getAgentForUser, listAgentsForUser, listAgentVersions } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { listEvalRunsForAgent } from "@/lib/evals";

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function EditAgentPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, ownedAgents, versions] = await appRuntime.runPromise(
    Effect.all([
      getAgentForUser(agentId, session.user.id).pipe(
        Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
      ),
      listAgentsForUser(session.user.id),
      listAgentVersions(agentId, session.user.id),
    ]),
  );

  if (!agent) notFound();

  if (agent.isSystem) redirect(`/agents/${agentId}`);

  const evalRuns = await appRuntime.runPromise(listEvalRunsForAgent(agentId));

  return (
    <div className="pb-safe-or-8 px-safe-or-4 sm:px-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain py-4 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">edit agent</h1>
        <p className="text-muted-foreground text-sm">{agent.name}</p>
      </div>
      <AgentForm
        evalRuns={evalRuns}
        initialAgent={{
          defaultModelId: agent.defaultModelId,
          description: agent.description,
          evals: agent.evals.map((e) => ({ ...e, scorer: e.scorer as Scorer })),
          id: agent.id,
          name: agent.name,
          subAgents: agent.subAgents,
          systemPrompt: agent.systemPrompt,
          tools: agent.tools,
        }}
        ownedAgents={ownedAgents}
      />
      {versions.length > 0 && <AgentVersionHistory agentId={agentId} versions={versions} />}
    </div>
  );
}
