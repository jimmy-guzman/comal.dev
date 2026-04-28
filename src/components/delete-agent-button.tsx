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
}

export const DeleteAgentButton = ({ agentId, agentName }: Props) => {
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
        <Button variant="outline">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {agentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This agent and all of its conversations will be permanently deleted. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {result.serverError ? (
          <p className="text-destructive text-sm">{result.serverError}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={() => {
              execute({ agentId });
            }}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
