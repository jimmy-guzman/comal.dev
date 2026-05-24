import { Effect } from "effect";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AgentSlimHeader } from "@/components/agent-slim-header";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";

interface Props {
  children: React.ReactNode;
  params: Promise<{ agentId: string }>;
}

export default async function AgentLayout({ children, params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, agents] = await Promise.all([
    appRuntime.runPromise(
      AgentService.getForUser(agentId, session.user.id).pipe(
        Effect.catchTag("AgentNotFoundError", () => Effect.succeed(null)),
      ),
    ),
    appRuntime.runPromise(AgentService.listForUser(session.user.id)),
  ]);

  if (!agent) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AgentSlimHeader
        agentId={agentId}
        agentName={agent.name}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        isSystem={agent.isSystem}
      />
      <main className="min-w-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</main>
    </div>
  );
}
