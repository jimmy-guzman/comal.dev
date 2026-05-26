"use client";

import { TrashIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import type { MemoryListItem } from "@/lib/memory";

import { deleteMemoryAction } from "@/actions/delete-memory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup } from "@/components/ui/item";
import { formatRelative } from "@/lib/format-relative";

interface Props {
  memories: MemoryListItem[];
}

const MemoryRow = ({ memory }: { memory: MemoryListItem }) => {
  const { execute, isPending } = useAction(deleteMemoryAction, {
    onError: ({ error }) => {
      toast.error(error.serverError ?? "failed to delete memory");
    },
    onSuccess: () => {
      toast.success("memory deleted");
    },
  });

  return (
    <Item className="px-4 py-3" variant="outline">
      <ItemContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{memory.sourceAgentName ?? "you"}</Badge>
          <span className="text-muted-foreground text-xs">{formatRelative(memory.createdAt)}</span>
        </div>
        <ItemDescription className="text-foreground whitespace-pre-wrap">
          {memory.content}
        </ItemDescription>
      </ItemContent>
      <Button
        aria-label="delete memory"
        disabled={isPending}
        onClick={() => {
          execute({ memoryId: memory.id });
        }}
        size="icon"
        variant="ghost"
      >
        <TrashIcon className="size-4" />
      </Button>
    </Item>
  );
};

export const MemoryList = ({ memories }: Props) => {
  if (memories.length === 0) {
    return <p className="text-muted-foreground text-sm">no memories yet.</p>;
  }

  return (
    <ItemGroup className="gap-2">
      {memories.map((memory) => {
        return <MemoryRow key={memory.id} memory={memory} />;
      })}
    </ItemGroup>
  );
};
