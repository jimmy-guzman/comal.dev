import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AgentForm } from "@/components/agent-form";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { ModelPricingService } from "@/lib/model-pricing";

async function fetchModelOutputCosts() {
  "use cache";

  cacheTag("model-pricing");
  cacheLife("hours");

  return appRuntime.runPromise(ModelPricingService.listOutputCosts());
}

export default async function NewAgentPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [ownedAgents, modelOutputCosts] = await Promise.all([
    appRuntime.runPromise(AgentService.listForUser(session.user.id)),
    fetchModelOutputCosts(),
  ]);

  return (
    <div className="pb-safe-or-8 px-safe-or-4 sm:px-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto overscroll-y-contain py-4 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">new agent</h1>
        <p className="text-muted-foreground text-sm">
          pick a model, write a prompt, and choose which tools the agent can use.
        </p>
      </div>
      <AgentForm modelOutputCosts={modelOutputCosts} ownedAgents={ownedAgents} />
    </div>
  );
}
