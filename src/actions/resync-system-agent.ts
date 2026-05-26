"use server";

import { Exit } from "effect";
import { updateTag } from "next/cache";

import { appRuntime } from "@/db/runtime";
import { authClient } from "@/lib/safe-action";
import { SystemAgentService } from "@/lib/system-agent";

export const resyncSystemAgentAction = authClient.action(async ({ ctx }) => {
  const exit = await appRuntime.runPromiseExit(SystemAgentService.resync(ctx.auth.user.id));

  if (Exit.isFailure(exit)) {
    throw new Error("Failed to resync system agent.");
  }

  const agentId = exit.value;

  updateTag(`agents:${ctx.auth.user.id}`);
  updateTag(`agent:${agentId}`);

  return { agentId };
});
