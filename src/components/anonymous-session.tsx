"use client";

import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";

export function AnonymousSession() {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending || session) return;

    void authClient.signIn.anonymous();
  }, [isPending, session]);

  return null;
}
