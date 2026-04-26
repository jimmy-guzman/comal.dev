"use client";

import type { LinkSafetyModalProps } from "streamdown";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const LinkSafetyModal = ({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) => {
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={isOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Open external link?</AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-xs break-all">
            {url}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Open link</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
