import { headers } from "next/headers";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { listRecentWorkspacesForUser } from "@/lib/studio";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const recentWorkspaces = session?.user ? await listRecentWorkspacesForUser(session.user.id) : [];

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto p-6 md:p-10">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Comal</h1>
        <p className="text-muted-foreground text-sm">
          Design your API in a workspace, chat with the model, and keep your progress across
          reloads.
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href="/workspaces/new">Create workspace</Link>
        </Button>
        {recentWorkspaces[0] ? (
          <Button asChild variant="outline">
            <Link href={`/workspaces/${recentWorkspaces[0].id}`}>Open most recent</Link>
          </Button>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-medium">Recent workspaces</h2>
        {recentWorkspaces.length === 0 ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle>No workspaces yet</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Start by creating your first workspace.
            </CardContent>
          </Card>
        ) : (
          recentWorkspaces.map((workspace) => (
            <Card key={workspace.id} size="sm">
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle>{workspace.title}</CardTitle>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/workspaces/${workspace.id}`}>Open</Link>
                </Button>
              </CardHeader>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
