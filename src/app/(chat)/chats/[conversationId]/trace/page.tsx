import { Effect } from "effect";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TraceTimeline } from "@/components/trace-timeline";
import { appRuntime } from "@/db/service";
import { auth } from "@/lib/auth";
import { getConversationTrace } from "@/lib/chat/store";
import { projectTrace } from "@/lib/chat/trace";

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default async function TracePage({ params }: Props) {
  const { conversationId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) notFound();

  const trace = await appRuntime.runPromise(
    getConversationTrace(session.user.id, conversationId).pipe(
      Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
      Effect.catchTag("ForbiddenError", () => Effect.succeed(null)),
    ),
  );

  if (!trace) notFound();

  const steps = projectTrace(trace.events, trace.conversationCreatedAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="px-safe-or-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="bg-background sticky top-0 z-10 flex items-center gap-3 py-3">
          <Link
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
            href={
              trace.kind === "eval" ? `/agents/${trace.agentId}/evals` : `/chats/${conversationId}`
            }
          >
            <ArrowLeftIcon className="size-3" />
            {trace.title}
          </Link>
          <span className="text-muted-foreground ml-auto text-xs">
            {trace.events.length} events
          </span>
        </div>
        <TraceTimeline steps={steps} />
      </main>
    </div>
  );
}
