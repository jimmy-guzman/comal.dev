import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MemoryCapForm } from "@/components/memory-cap-form";
import { appRuntime } from "@/db/runtime";
import { auth } from "@/lib/auth";
import { MemoryService } from "@/lib/memory";

async function fetchCap(userId: string) {
  "use cache";

  cacheTag(`memories:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(MemoryService.getCap(userId));
}

async function fetchCount(userId: string) {
  "use cache";

  cacheTag(`memories:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(MemoryService.countForUser(userId));
}

export default async function MemorySettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [cap, count] = await Promise.all([fetchCap(session.user.id), fetchCount(session.user.id)]);

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">memory</h1>
        <p className="text-muted-foreground text-sm">
          how many memories agents are allowed to keep. view or add memories at{" "}
          <Link className="hover:text-foreground underline" href="/memories">
            /memories
          </Link>
          .
        </p>
      </div>
      <MemoryCapForm initialCap={cap} />
      <p className="text-muted-foreground text-xs">
        using {count} of {cap}.
      </p>
    </div>
  );
}
