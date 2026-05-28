import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountPanel } from "@/components/account-panel";
import { auth } from "@/lib/auth";

export default async function AccountSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">account</h1>
        <p className="text-muted-foreground text-sm">your profile and session.</p>
      </div>
      <AccountPanel
        email={session.user.email}
        image={session.user.image ?? null}
        isAnonymous={Boolean(session.user.isAnonymous)}
        name={session.user.name}
      />
    </div>
  );
}
