import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getAgent } from "@/agents";
import { auth } from "@/lib/auth";
import { createConversation } from "@/lib/chat";

interface Props {
  params: Promise<{ agentId: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  const { agentId } = await params;

  const agent = getAgent(agentId);

  if (!agent) notFound();

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const conversation = await createConversation({
    userId: session.user.id,
    agentId: agent.id,
    title: "New conversation",
    modelId: agent.defaultModelId,
  });

  revalidatePath("/", "layout");

  redirect(`/agents/${agentId}/conversations/${conversation.id}`);
}
