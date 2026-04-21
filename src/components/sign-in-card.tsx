"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function SignInCard({ className, ...props }: React.ComponentProps<"div">) {
  const [pending, setPending] = useState(false);

  const handleGithub = async () => {
    setPending(true);

    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: `${env.NEXT_PUBLIC_APP_URL}/`,
        errorCallbackURL: `${env.NEXT_PUBLIC_APP_URL}/sign-in?error=oauth`,
      });
    } catch {
      toast.error("Couldn't start sign-in. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Save your work</CardTitle>
          <CardDescription>
            Sign in with GitHub to persist your specs across devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" disabled={pending} onClick={handleGithub}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Continue with GitHub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
