import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Effect, Exit } from "effect";

import { getAgent } from "@/agents";
import { DatabaseLive } from "@/db/service";
import { auth } from "@/lib/auth";
import { createConversation } from "@/lib/chat";
import { DatabaseError } from "@/lib/errors";

interface Props {
  params: Promise<{ agentId: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  const { agentId } = await params;

  const agent = getAgent(agentId);

  if (!agent) notFound();

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const program = Effect.gen(function* () {
    const conversation = yield* Effect.provide(
      createConversation({
        userId: session.user.id,
        agentId: agent.id,
        title: "New conversation",
        modelId: agent.defaultModelId,
      }),
      DatabaseLive,
    );

    return conversation;
  }) satisfies Effect.Effect<{ id: string }, DatabaseError, never>;

  const exit = await Effect.runPromiseExit(program);

  return Exit.match(exit, {
    onSuccess: ({ id }) => {
      revalidatePath("/", "layout");
      redirect(`/agents/${agentId}/conversations/${id}`);
    },
    onFailure: (cause) => {
      console.error("[conversations/new] unexpected error:", cause);
      return new Response("Internal server error.", { status: 500 });
    },
  });
}
