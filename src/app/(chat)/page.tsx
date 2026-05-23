import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { provisionSystemAgentAction } from "@/actions/provision-system-agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appRuntime } from "@/db/service";
import { listAgentsForUser } from "@/lib/agents";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const agents = session?.user
    ? await appRuntime.runPromise(listAgentsForUser(session.user.id))
    : [];

  const mostRecent = agents.at(0);

  return (
    <div className="pb-safe-or-8 flex min-h-0 flex-1 flex-col items-center justify-center gap-12 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image alt="comal.dev mascot" height={80} priority src="/mascot.svg" width={80} />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-4xl font-semibold tracking-tight">comal.dev</h1>
            <Badge variant="outline">alpha</Badge>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">
            An open source playground for composing your own AI agents from a shared toolbox. Built
            by{" "}
            <a
              className="hover:text-foreground underline underline-offset-4 transition-colors"
              href="https://jimmy.codes"
              rel="noopener noreferrer"
              target="_blank"
            >
              jimmy.codes
            </a>
            .
          </p>
        </div>
      </div>

      {mostRecent === undefined ? (
        <form action={provisionSystemAgentAction}>
          <Button size="lg" type="submit">
            get started
          </Button>
        </form>
      ) : (
        <Button asChild size="lg">
          <Link href={`/chats/new?agent=${mostRecent.id}`}>new chat</Link>
        </Button>
      )}
    </div>
  );
}
