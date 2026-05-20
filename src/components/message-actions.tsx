"use client";

import { EllipsisIcon } from "lucide-react";
import { useState } from "react";

import { MessageActions } from "@/components/ai-elements/message";
import { SaveAsEvalDialog } from "@/components/save-as-eval-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  agentId: string;
  assistantText: string;
  userText: string;
}

export const MessageActionsMenu = ({ agentId, assistantText, userText }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <MessageActions>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="text-muted-foreground" size="icon-sm" type="button" variant="ghost">
              <EllipsisIcon className="size-4" />
              <span className="sr-only">message actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem
              onSelect={() => {
                setDialogOpen(true);
              }}
            >
              save as eval
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </MessageActions>
      <SaveAsEvalDialog
        agentId={agentId}
        defaultExpected={assistantText}
        defaultInput={userText}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </>
  );
};
