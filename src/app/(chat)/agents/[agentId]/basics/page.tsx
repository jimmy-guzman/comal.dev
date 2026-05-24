import { Effect } from "effect";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { ModelOutputCosts } from "@/lib/model-pricing";

import { AgentBasicsForm } from "@/components/agent-basics-form";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";
import { ModelPricingService } from "@/lib/model-pricing";

const EMPTY_MODEL_OUTPUT_COSTS: ModelOutputCosts = {};

async function fetchAgent(agentId: string, userId: string) {
  "use cache";

  cacheTag(`agent:${agentId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(
    AgentService.getForUser(agentId, userId).pipe(
      Effect.catchTag("AgentNotFoundError", () => Effect.succeed(null)),
    ),
  );
}

async function fetchModelOutputCosts() {
  "use cache";

  cacheTag("model-pricing");
  cacheLife("hours");

  return appRuntime.runPromise(
    ModelPricingService.listOutputCosts().pipe(
      Effect.tapError((error) => {
        return Effect.logError("basics page model-pricing lookup failed", error);
      }),
      Effect.catchAll(() => Effect.succeed(EMPTY_MODEL_OUTPUT_COSTS)),
    ),
  );
}

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function AgentBasicsPage({ params }: Props) {
  const { agentId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [agent, modelOutputCosts] = await Promise.all([
    fetchAgent(agentId, session.user.id),
    fetchModelOutputCosts(),
  ]);

  if (!agent) notFound();

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">basics</h2>
        <p className="text-muted-foreground text-sm">name, description, and default model.</p>
      </div>
      <AgentBasicsForm
        agentId={agentId}
        initialDefaultModelId={agent.defaultModelId}
        initialDescription={agent.description}
        initialName={agent.name}
        modelOutputCosts={modelOutputCosts}
        readOnly={agent.isSystem}
      />
    </div>
  );
}
