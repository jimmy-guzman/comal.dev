import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MemoryAddForm } from "@/components/memory-add-form";
import { MemoryCapForm } from "@/components/memory-cap-form";
import { MemoryList } from "@/components/memory-list";
import { appRuntime } from "@/db/runtime";
import { auth } from "@/lib/auth";
import { MemoryService } from "@/lib/memory";

async function fetchMemories(userId: string) {
  "use cache";

  cacheTag(`memories:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(MemoryService.listForUser(userId));
}

async function fetchCap(userId: string) {
  "use cache";

  cacheTag(`memories:${userId}`);
  cacheLife("minutes");

  return appRuntime.runPromise(MemoryService.getCap(userId));
}

export default async function MemoriesPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  const [memories, cap] = await Promise.all([
    fetchMemories(session.user.id),
    fetchCap(session.user.id),
  ]);

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">memories</h1>
        <p className="text-muted-foreground text-sm">
          facts agents have saved about you, plus anything you add manually. agents must have memory
          enabled on their basics page to read or write here.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">cap</h2>
        <MemoryCapForm initialCap={cap} />
        <p className="text-muted-foreground text-xs">
          using {memories.length} of {cap}.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">add</h2>
        <MemoryAddForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">all memories</h2>
        <MemoryList memories={memories} />
      </section>
    </div>
  );
}
