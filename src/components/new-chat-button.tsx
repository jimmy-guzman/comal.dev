"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface Props {
  agents: { id: string; name: string }[];
}

export const NewChatButton = ({ agents }: Props) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <SidebarMenuButton>
          <PlusIcon />
          <span>New chat</span>
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1" side="right">
        {agents.length === 0 ? (
          <div className="flex flex-col gap-2 p-2 text-xs">
            <p className="text-muted-foreground">No agents yet.</p>
            <Link
              className="text-foreground hover:underline"
              href="/agents/new"
              onClick={() => {
                setOpen(false);
              }}
            >
              Create your first agent →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col">
            {agents.map((agent) => {
              return (
                <li key={agent.id}>
                  <Link
                    className="hover:bg-accent hover:text-accent-foreground block rounded-sm px-2 py-1.5 text-sm"
                    href={`/agents/${agent.id}/conversations/new` as const}
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    {agent.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};
