"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { appRuntime } from "@/db/service";
import { auth } from "@/lib/auth";
import { getOrCreateSystemAgent } from "@/lib/system-agent";

export async function provisionSystemAgentAction() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Error("Not authenticated.");
  }

  const exit = await appRuntime.runPromiseExit(getOrCreateSystemAgent(session.user.id));

  if (Exit.isFailure(exit)) {
    throw new Error("Failed to provision system agent.");
  }

  const agentId = exit.value;

  updateTag(`agents:${session.user.id}`);

  redirect(`/chats/new?agent=${agentId}`);
}
