"use client";

import { BotIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Agent {
  id: string;
  name: string;
}

interface Props {
  agents: Agent[];
  onValueChange: (agentId: string) => void;
  value: string;
}

export const ChatAgentPicker = ({ agents, onValueChange, value }: Props) => {
  const [open, setOpen] = useState(false);

  const current = agents.find((a) => a.id === value);
  const triggerLabel = current?.name ?? "unknown agent";

  const handleSelect = (agentId: string) => {
    onValueChange(agentId);
    setOpen(false);
  };

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="select agent"
          className="text-muted-foreground hover:text-foreground h-8 min-w-0 max-w-36 gap-1.5 px-2 font-medium sm:max-w-none"
          size="sm"
          variant="ghost"
        >
          <BotIcon className="hidden size-4 shrink-0 sm:block" />
          <span className="truncate">{triggerLabel}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {agents.map((agent) => {
          return (
            <DropdownMenuItem
              data-checked={agent.id === value}
              key={agent.id}
              onSelect={() => {
                handleSelect(agent.id);
              }}
            >
              {agent.name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
