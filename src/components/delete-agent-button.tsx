"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import * as React from "react";

import { deleteAgentAction } from "@/actions/delete-agent";
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
  agentId: string;
  agentName: string;
  trigger?: React.ReactNode;
}

export const DeleteAgentButton = ({ agentId, agentName, trigger }: Props) => {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const { execute, isPending, result } = useAction(deleteAgentAction, {
    onSuccess: () => {
      setOpen(false);
      router.push("/agents");
    },
  });

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        {trigger ?? <Button variant="outline">delete</Button>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>delete {agentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            this agent and all of its conversations will be permanently deleted. this cannot be
            undone.
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
              execute({ agentId });
            }}
            variant="destructive"
          >
            {isPending ? "deleting..." : "delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
