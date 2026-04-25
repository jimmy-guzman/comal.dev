"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { deleteConversationAction } from "@/actions/delete-conversation";
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

interface Props {
  agentId: string;
  conversationId: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  redirectAfter?: boolean;
  trigger?: React.ReactNode;
}

export const DeleteConversationButton = ({
  agentId,
  conversationId,
  onOpenChange,
  open: controlledOpen,
  redirectAfter = false,
  trigger,
}: Props) => {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setUncontrolledOpen(next);
    }
  };

  const handleDelete = async () => {
    setIsPending(true);

    await deleteConversationAction({ conversationId });

    setIsPending(false);
    setOpen(false);

    if (redirectAfter) {
      router.push(`/agents/${agentId}`);
    }
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            This conversation and all its messages will be permanently deleted. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={() => void handleDelete()}
          >
            <Trash2Icon />
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
