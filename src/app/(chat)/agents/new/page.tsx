import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AgentForm } from "@/components/agent-form";
import { auth } from "@/lib/auth";

export default async function NewAgentPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">New agent</h1>
        <p className="text-muted-foreground text-sm">
          Pick a model, write a prompt, and choose which tools the agent can use.
        </p>
      </div>
      <AgentForm />
    </div>
  );
}
