import { Effect, Exit } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { DatabaseLive } from "@/db/service";
import { getAgentForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { createConversation } from "@/lib/chat";

interface Props {
  params: Promise<{ agentId: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  const { agentId } = await params;

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) redirect("/sign-in");

  const program = Effect.gen(function* () {
    const agent = yield* getAgentForUser(agentId, session.user.id);

    return yield* createConversation({
      agentId: agent.id,
      modelId: agent.defaultModelId,
      title: "New conversation",
      userId: session.user.id,
    });
  }).pipe(Effect.provide(DatabaseLive));

  const exit = await Effect.runPromiseExit(program);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const failure = cause._tag === "Fail" ? cause.error : null;

      if (failure?._tag === "NotFoundError") notFound();

      return new Response("Internal server error.", { status: 500 });
    },
    onSuccess: ({ id }) => {
      revalidatePath("/", "layout");
      redirect(`/agents/${agentId}/conversations/${id}`);
    },
  });
}
