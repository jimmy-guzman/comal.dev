import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { appRuntime } from "@/db/runtime";
import { AgentService } from "@/lib/agents";
import { auth } from "@/lib/auth";

export default async function AgentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const agents = await appRuntime.runPromise(AgentService.listForUser(session.user.id));

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">agents</h1>
        <Button asChild size="sm">
          <Link href="/agents/new">new agent</Link>
        </Button>
      </div>

      {agents.length === 0 ? (
        <p className="text-muted-foreground text-sm">no agents yet.</p>
      ) : (
        <ItemGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => {
            return (
              <Item asChild className="h-full" key={a.id} variant="outline">
                <Link href={`/agents/${a.id}`}>
                  <ItemContent>
                    <ItemTitle className="flex flex-wrap items-center gap-2">
                      <span>{a.name}</span>
                      {a.isSystem ? <Badge variant="secondary">system</Badge> : null}
                    </ItemTitle>
                    <ItemDescription>{a.description ?? "no description"}</ItemDescription>
                  </ItemContent>
                </Link>
              </Item>
            );
          })}
        </ItemGroup>
      )}
    </div>
  );
}
