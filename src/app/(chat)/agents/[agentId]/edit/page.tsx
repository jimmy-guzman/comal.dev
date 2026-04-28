import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AgentForm } from "@/components/agent-form";
import { runWithDb } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function EditAgentPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agent = await runWithDb(
    getAgentForUser(agentId, session.user.id).pipe(
      Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
    ),
  );

  if (!agent) notFound();

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Edit agent</h1>
        <p className="text-muted-foreground text-sm">{agent.name}</p>
      </div>
      <AgentForm
        initialAgent={{
          defaultModelId: agent.defaultModelId,
          description: agent.description,
          id: agent.id,
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          tools: agent.tools,
        }}
      />
    </div>
  );
}
