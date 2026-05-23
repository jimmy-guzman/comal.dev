import { Effect } from "effect";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AgentBreadcrumbPicker } from "@/components/agent-breadcrumb-picker";
import { AgentSettingsMobileNav } from "@/components/agent-settings-mobile-nav";
import { AgentSettingsNav } from "@/components/agent-settings-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <header className="flex h-12 shrink-0 items-center gap-4 border-b px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            className="text-muted-foreground hover:text-foreground shrink-0 text-sm transition-colors"
            href="/agents"
          >
            agents
          </Link>
          <span className="text-muted-foreground shrink-0 text-sm">/</span>
          {agent.isSystem ? (
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
              <span className="truncate">{agent.name}</span>
              <Badge className="shrink-0 text-xs" variant="secondary">
                system
              </Badge>
            </span>
          ) : (
            <AgentBreadcrumbPicker
              agents={agents.map((a) => ({ id: a.id, name: a.name }))}
              currentAgentId={agentId}
              currentAgentName={agent.name}
            />
          )}
          <span className="text-muted-foreground shrink-0 text-sm sm:hidden">/</span>
          <AgentSettingsMobileNav agentId={agentId} />
        </div>

        <div className="ml-auto">
          <Button asChild className="hidden sm:inline-flex" size="sm">
            <Link href={`/chats/new?agent=${agentId}`}>new chat</Link>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="hidden px-4 py-6 sm:block sm:px-6">
          <AgentSettingsNav agentId={agentId} />
        </div>

        <main className="min-w-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</main>
      </div>
    </div>
  );
}
