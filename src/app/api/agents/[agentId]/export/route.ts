import { Effect } from "effect";
import { kebabCase } from "es-toolkit";
import { headers } from "next/headers";

import { appRuntime } from "@/db/runtime";
import { buildAgentExport } from "@/lib/agent-export";
import { auth } from "@/lib/auth";

interface Params {
  params: Promise<{ agentId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { agentId } = await params;

  return await appRuntime.runPromise(
    buildAgentExport(agentId, session.user.id).pipe(
      Effect.match({
        onFailure: (error) => {
          if (error._tag === "AgentNotFoundError") {
            return Response.json({ error: "Agent not found." }, { status: 404 });
          }

          return Response.json({ error: "Internal server error." }, { status: 500 });
        },
        onSuccess: (payload) => {
          const slug = kebabCase(payload.agent.name) || `agent-${payload.agent.id}`;

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
