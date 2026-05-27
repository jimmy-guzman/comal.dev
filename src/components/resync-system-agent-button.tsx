"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import * as React from "react";

import { resyncSystemAgentAction } from "@/actions/resync-system-agent";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  trigger?: React.ReactNode;
}

export const ResyncSystemAgentButton = ({ trigger }: Props) => {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const { execute, isPending, result } = useAction(resyncSystemAgentAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        {trigger ?? <Button variant="outline">resync</Button>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>resync system agent?</AlertDialogTitle>
          <AlertDialogDescription>
            this overwrites the current name, model, prompt, suggestions, and tools with the latest
            built-in defaults.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {result.serverError ? (
          <p
            aria-atomic="true"
            aria-live="assertive"
            className="text-destructive text-sm"
            role="alert"
          >
            {result.serverError}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => {
              execute();
            }}
          >
            {isPending ? "resyncing..." : "resync"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
