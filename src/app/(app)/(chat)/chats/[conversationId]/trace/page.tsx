import { Effect } from "effect";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TraceTimeline } from "@/components/trace-timeline";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { appRuntime } from "@/db/runtime";
import { auth } from "@/lib/auth";
import { ChatStoreService } from "@/lib/chat/store";
import { projectTrace } from "@/lib/chat/trace";
import { formatMicrodollars } from "@/lib/format-cost";

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default async function TracePage({ params }: Props) {
  const { conversationId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) notFound();

  const trace = await appRuntime.runPromise(
    ChatStoreService.getConversationTrace(session.user.id, conversationId).pipe(
      Effect.catchTag("ConversationNotFoundError", () => Effect.succeed(null)),
      Effect.catchTag("ForbiddenError", () => Effect.succeed(null)),
    ),
  );

  if (!trace) notFound();

  const steps = projectTrace(trace.events, trace.conversationCreatedAt);

  const totalCostMicrodollars = trace.events.reduce((sum, event) => {
    return sum + (event.costMicrodollars ?? 0);
  }, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="px-safe-or-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="bg-background sticky top-0 z-10 flex items-center gap-3 py-3">
          <SidebarTrigger />
          <Link
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
            href={
              trace.kind === "eval" ? `/agents/${trace.agentId}/evals` : `/chats/${conversationId}`
            }
          >
            <ArrowLeftIcon className="size-3" />
            {trace.title}
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              {totalCostMicrodollars > 0 && (
                <span className="font-mono">{formatMicrodollars(totalCostMicrodollars)}</span>
              )}
              <span>{trace.events.length} events</span>
            </div>
            <Button asChild size="sm" variant="outline">
              <a download href={`/api/traces/${conversationId}/export`}>
                export
              </a>
            </Button>
          </div>
        </div>
        <TraceTimeline steps={steps} />
      </main>
    </div>
  );
}
