import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { Scorer } from "@/lib/eval-input-schema";

import { AgentEvalsForm } from "@/components/agent-evals-form";
import { appRuntime } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { listEvalRunsForAgent } from "@/lib/evals";

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

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentEvalsPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agent = await fetchAgent(agentId, session.user.id);

  if (!agent) notFound();

  if (agent.isSystem) redirect(`/agents/${agentId}`);

  const evalRuns = await appRuntime.runPromise(listEvalRunsForAgent(agentId));

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">evals</h2>
        <p className="text-muted-foreground text-sm">
          test cases that run against your agent automatically.
        </p>
      </div>
      <AgentEvalsForm
        agentId={agentId}
        evalRuns={evalRuns}
        initialEvals={agent.evals.map((e) => {
          return { ...e, expected: e.expected ?? undefined, scorer: e.scorer as Scorer };
        })}
      />
    </div>
  );
}
