import { Effect } from "effect";
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
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Link
          className="text-muted-foreground hover:text-foreground text-xs"
          href={`/chats/${conversationId}`}
        >
          back to chat
        </Link>
        <span className="text-muted-foreground text-xs">/</span>
        <h1 className="truncate text-sm font-medium">{trace.title}</h1>
        <span className="text-muted-foreground ml-auto text-xs">{trace.events.length} events</span>
      </header>
      <main className="px-safe-or-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <TraceTimeline steps={steps} />
      </main>
    </div>
  );
}
