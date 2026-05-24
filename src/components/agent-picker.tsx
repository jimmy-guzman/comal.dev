"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
}

interface Props {
  agentId: string;
  agentName: string;
  agents: Agent[];
  className?: string;
  isSystem: boolean;
}

export const AgentPicker = ({ agentId, agentName, agents, className, isSystem }: Props) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (isSystem) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
        <span className="truncate">{agentName}</span>
        <Badge className="shrink-0 text-xs" variant="secondary">
          system
        </Badge>
      </span>
    );
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="switch agent"
          className={cn("h-auto min-w-0 gap-1 px-1 py-0", className)}
          variant="ghost"
        >
          <span className="truncate">{agentName}</span>
          <ChevronDownIcon className="shrink-0 opacity-60" data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          {agents.map((agent) => {
            return (
              <DropdownMenuItem
                data-checked={agent.id === agentId}
                key={agent.id}
                onSelect={() => {
                  setOpen(false);
                  router.push(`/agents/${agent.id}`);
                }}
              >
                {agent.name}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
