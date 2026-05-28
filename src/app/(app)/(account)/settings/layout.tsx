import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SettingsSlimHeader } from "@/components/settings-slim-header";
import { auth } from "@/lib/auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SettingsSlimHeader />
      <main className="min-w-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</main>
    </div>
  );
}
