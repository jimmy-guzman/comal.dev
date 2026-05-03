"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type SignInCardProps = React.ComponentProps<"div"> & {
  previewDisabled?: boolean;
};

export function SignInCard({ className, previewDisabled = false, ...props }: SignInCardProps) {
  const [pending, setPending] = useState(false);

  const handleGithub = async () => {
    setPending(true);

    try {
      await authClient.signIn.social({
        callbackURL: "/",
        errorCallbackURL: "/sign-in?error=oauth",
        provider: "github",
      });
    } catch {
      toast.error("couldn't start sign-in. please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>save your work</CardTitle>
          <CardDescription>
            {previewDisabled
              ? "GitHub sign-in is disabled on preview deployments. use the production site to sign in."
              : "sign in with GitHub to persist your specs across devices."}
          </CardDescription>
        </CardHeader>
        {previewDisabled ? null : (
          <CardContent>
            <Button className="w-full" disabled={pending} onClick={handleGithub}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              continue with GitHub
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
