"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { deleteConversationAction } from "@/actions/delete-conversation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete conversation?</DialogTitle>
          <DialogDescription>
            This conversation and all its messages will be permanently deleted. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={isPending} variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={isPending}
            onClick={() => void handleDelete()}
            variant="destructive"
          >
            <Trash2Icon />
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
