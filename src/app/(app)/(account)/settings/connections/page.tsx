import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { ApiKeyConnectionStatus, OAuthConnectionStatus } from "@/lib/credentials/service";

import { ApiKeyConnectionRow } from "@/components/api-key-connection-row";
import { OAuthConnectionRow } from "@/components/oauth-connection-row";
import { appRuntime } from "@/db/runtime";
import { auth } from "@/lib/auth";
import { Credentials } from "@/lib/credentials/service";

async function fetchConnections(userId: string) {
  "use cache";

  cacheTag(`connections:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(Credentials.list(userId));
}

const noteFor = (providerId: string): string | undefined => {
  if (providerId === "openrouter") return "affects all model calls in your conversations.";

  return undefined;
};

export default async function ConnectionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  if (session.user.isAnonymous) {
    return (
      <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">connections</h1>
          <p className="text-muted-foreground text-sm">
            sign in with a real account to manage connections.
          </p>
        </div>
      </div>
    );
  }

  const statuses = await fetchConnections(session.user.id);

  const apiKeyRows: ApiKeyConnectionStatus[] = [];
  const oauthRows: OAuthConnectionStatus[] = [];

  for (const status of statuses) {
    if (status.kind === "api_key") apiKeyRows.push(status);
    else oauthRows.push(status);
  }

  const openrouterRow = apiKeyRows.find((r) => r.providerId === "openrouter");
  const otherApiKeyRows = apiKeyRows.filter((r) => r.providerId !== "openrouter");

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">connections</h1>
        <p className="text-muted-foreground text-sm">
          bring your own keys for the services this app talks to. when you set a key, your requests
          use it instead of the platform default.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">api keys</h2>
        <div className="flex flex-col gap-3">
          {openrouterRow ? (
            <ApiKeyConnectionRow note={noteFor(openrouterRow.providerId)} status={openrouterRow} />
          ) : null}
          {otherApiKeyRows.map((status) => {
            return (
              <ApiKeyConnectionRow
                key={status.providerId}
                note={noteFor(status.providerId)}
                status={status}
              />
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">sign-in & oauth</h2>
        <div className="flex flex-col gap-3">
          {oauthRows.map((status) => {
            return (
              <OAuthConnectionRow
                isSignIn={status.signInOnly}
                key={status.providerId}
                status={status}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
