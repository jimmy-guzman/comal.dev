import { headers } from "next/headers";

import { SignInCard } from "@/components/sign-in-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isLinked = session?.user && !session.user.isAnonymous;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto p-6 md:p-10">
      <div className="w-full max-w-sm">
        {isLinked ? (
          <Card>
            <CardHeader>
              <CardTitle>You&apos;re signed in</CardTitle>
              <CardDescription>Your specs are being saved to your account.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <SignInCard />
        )}
      </div>
    </div>
  );
}
