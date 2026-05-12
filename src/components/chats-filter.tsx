"use client";

import { useQueryState } from "nuqs";

import { chatSearchParams } from "@/app/(chat)/chats/search-params";
import { Button } from "@/components/ui/button";

interface Agent {
  id: string;
  name: string;
}

interface Props {
  agents: Agent[];
}

export const ChatsFilter = ({ agents }: Props) => {
  const [agentFilter, setAgentFilter] = useQueryState(
    "agent",
    chatSearchParams.agent.withOptions({ shallow: false }),
  );

  if (agents.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        className="h-7 text-xs"
        onClick={() => {
          void setAgentFilter(null);
        }}
        size="sm"
        variant={agentFilter === null ? "secondary" : "ghost"}
      >
        all
      </Button>
      {agents.map((agent) => {
        return (
          <Button
            className="h-7 text-xs"
            key={agent.id}
            onClick={() => {
              void setAgentFilter(agent.id);
            }}
            size="sm"
            variant={agentFilter === agent.id ? "secondary" : "ghost"}
          >
            {agent.name}
          </Button>
        );
      })}
    </div>
  );
};
