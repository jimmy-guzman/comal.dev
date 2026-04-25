import { Effect, Exit } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { DatabaseError } from "@/lib/errors";

import { getAgent } from "@/agents";
import { DatabaseLive } from "@/db/service";
import { auth } from "@/lib/auth";
import { createConversation } from "@/lib/chat";

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
        agentId: agent.id,
        modelId: agent.defaultModelId,
        title: "New conversation",
        userId: session.user.id,
      }),
      DatabaseLive,
    );

    return conversation;
  }) satisfies Effect.Effect<{ id: string }, DatabaseError>;

  const exit = await Effect.runPromiseExit(program);

  return Exit.match(exit, {
    onFailure: () => new Response("Internal server error.", { status: 500 }),
    onSuccess: ({ id }) => {
      revalidatePath("/", "layout");
      redirect(`/agents/${agentId}/conversations/${id}`);
    },
  });
}
