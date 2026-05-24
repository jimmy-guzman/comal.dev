import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AgentSuggestionsForm } from "@/components/agent-suggestions-form";
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

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentSuggestionsPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agent = await fetchAgent(agentId, session.user.id);

  if (!agent) notFound();

  if (agent.isSystem) redirect(`/agents/${agentId}`);

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">suggestions</h2>
        <p className="text-muted-foreground text-sm">
          starter prompts shown when a new chat with this agent is empty.
        </p>
      </div>
      <AgentSuggestionsForm agentId={agentId} initialSuggestions={agent.suggestions} />
    </div>
  );
}
