import { PlusIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runWithDb } from "@/db/service";
import { listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";

export default async function AgentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agents = await runWithDb(listAgentsForUser(session.user.id));

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Your agents</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          return (
            <Link
              className="group focus-visible:ring-ring rounded-lg outline-hidden focus-visible:ring-2"
              href={`/agents/${a.id}` as const}
              key={a.id}
            >
              <Card className="group-hover:border-foreground/30 group-hover:bg-accent/30 h-full transition-colors">
                <CardHeader>
                  <CardTitle>{a.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {a.description ?? "No description"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}

        <Link
          className="group focus-visible:ring-ring rounded-lg outline-hidden focus-visible:ring-2"
          href="/agents/new"
        >
          <Card className="text-muted-foreground group-hover:border-foreground/30 group-hover:bg-accent/30 group-hover:text-foreground flex h-full items-center justify-center border-dashed transition-colors">
            <div className="flex items-center gap-2 text-sm">
              <PlusIcon className="size-4" />
              New agent
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
