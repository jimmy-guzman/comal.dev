"use client";

import Image from "next/image";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function ErrorBoundary({ error, unstable_retry }: Props) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- surface unhandled errors during dev; replaced by reporter in prod
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-12 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image alt="comal.dev mascot" height={80} priority src="/mascot.svg" width={80} />
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground max-w-sm text-sm">
            An unexpected error occurred. You can try again, or come back in a moment.
          </p>
        </div>
      </div>
      <Button onClick={unstable_retry} size="lg">
        Try again
      </Button>
    </div>
  );
}
