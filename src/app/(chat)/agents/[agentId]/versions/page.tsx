import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AgentVersionHistory } from "@/components/agent-version-history";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";

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

async function fetchVersions(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(AgentService.listVersions(agentId, userId));
}

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentVersionsPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, versions] = await Promise.all([
    fetchAgent(agentId, session.user.id),
    fetchVersions(agentId, session.user.id),
  ]);

  if (!agent) notFound();

  if (agent.isSystem) redirect(`/agents/${agentId}`);

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">versions</h2>
        <p className="text-muted-foreground text-sm">
          history of changes to this agent. revert to any point.
        </p>
      </div>
      {versions.length === 0 ? (
        <p className="text-muted-foreground text-sm">no versions yet.</p>
      ) : (
        <AgentVersionHistory agentId={agentId} versions={versions} />
      )}
    </div>
  );
}
