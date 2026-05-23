import { Effect } from "effect";
import { kebabCase } from "es-toolkit";
import { headers } from "next/headers";

import { appRuntime } from "@/db/runtime";
import { auth } from "@/lib/auth";
import { buildTraceExport } from "@/lib/trace-export";

interface Params {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { conversationId } = await params;

  return await appRuntime.runPromise(
    buildTraceExport(conversationId, session.user.id).pipe(
      Effect.match({
        onFailure: (error) => {
          if (error._tag === "ConversationNotFoundError") {
            return Response.json({ error: "Trace not found." }, { status: 404 });
          }

          return Response.json({ error: "Internal server error." }, { status: 500 });
        },
        onSuccess: (payload) => {
          const slug = kebabCase(payload.trace.title) || `trace-${payload.trace.id}`;

          return new Response(JSON.stringify(payload, null, 2), {
            headers: {
              "Content-Disposition": `attachment; filename="${slug}.json"`,
              "Content-Type": "application/json; charset=utf-8",
            },
          });
        },
      }),
    ),
  );
}
