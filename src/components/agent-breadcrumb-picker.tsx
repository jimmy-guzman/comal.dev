"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Agent {
  id: string;
  name: string;
}

interface Props {
  agents: Agent[];
  currentAgentId: string;
  currentAgentName: string;
}

export const AgentBreadcrumbPicker = ({ agents, currentAgentId, currentAgentName }: Props) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="switch agent"
          className="h-auto gap-1 px-1 py-0 text-sm font-medium"
          variant="ghost"
        >
          {currentAgentName}
          <ChevronDownIcon className="shrink-0 opacity-60" data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          {agents.map((agent) => {
            return (
              <DropdownMenuItem
                data-checked={agent.id === currentAgentId}
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
