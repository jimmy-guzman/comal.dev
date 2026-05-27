"use client";

import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { AgentPicker } from "@/components/agent-picker";
import { Button } from "@/components/ui/button";

interface Agent {
  id: string;
  name: string;
}

interface Props {
  agentId: string;
  agentName: string;
  agents: Agent[];
  isSystem: boolean;
}

export const AgentSlimHeader = ({ agentId, agentName, agents, isSystem }: Props) => {
  const segment = useSelectedLayoutSegment();

  if (segment === null) {
    return (
      <header className="flex h-10 shrink-0 items-center border-b ps-12 pe-4 sm:ps-14 sm:pe-6">
        <Button
          asChild
          className="text-muted-foreground hover:text-foreground h-auto px-1 py-0"
          size="sm"
          variant="ghost"
        >
          <Link href="/agents">
            <ChevronLeftIcon data-icon="inline-start" />
            agents
          </Link>
        </Button>
      </header>
    );
  }

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b ps-12 pe-4 sm:ps-14 sm:pe-6">
      <Button aria-label="back to overview" asChild size="icon-sm" variant="ghost">
        <Link href={`/agents/${agentId}`}>
          <ChevronLeftIcon />
        </Link>
      </Button>
      <AgentPicker
        agentId={agentId}
        agentName={agentName}
        agents={agents}
        className="text-sm font-medium"
        isSystem={isSystem}
      />
    </header>
  );
};
