"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Props {
  agentId: string;
}

const NAV_ITEMS = [{ label: "overview", segment: null }] as const;

const CONFIG_ITEMS = [
  { label: "basics", segment: "basics" },
  { label: "prompt", segment: "prompt" },
  { label: "tools", segment: "tools" },
  { label: "sub-agents", segment: "sub-agents" },
  { label: "evals", segment: "evals" },
] as const;

const BOTTOM_ITEMS = [
  { label: "versions", segment: "versions" },
  { label: "danger zone", segment: "danger" },
] as const;

interface NavItemProps {
  active: boolean;
  agentId: string;
  label: string;
  segment: null | string;
}

const NavItem = ({ active, agentId, label, segment }: NavItemProps) => {
  return (
    <Button
      asChild
      className="w-full justify-start"
      size="sm"
      variant={active ? "secondary" : "ghost"}
    >
      <Link
        aria-current={active ? "page" : undefined}
        href={segment === null ? `/agents/${agentId}` : `/agents/${agentId}/${segment}`}
      >
        {label}
      </Link>
    </Button>
  );
};

export const AgentSettingsNav = ({ agentId }: Props) => {
  const currentSegment = useSelectedLayoutSegment();

  return (
    <nav aria-label="agent settings" className="flex w-48 shrink-0 flex-col gap-1 pt-1">
      {NAV_ITEMS.map(({ label, segment }) => {
        return (
          <NavItem
            active={currentSegment === segment}
            agentId={agentId}
            key={label}
            label={label}
            segment={segment}
          />
        );
      })}

      <Separator className="my-2" />

      {CONFIG_ITEMS.map(({ label, segment }) => {
        return (
          <NavItem
            active={currentSegment === segment}
            agentId={agentId}
            key={label}
            label={label}
            segment={segment}
          />
        );
      })}

      <Separator className="my-2" />

      {BOTTOM_ITEMS.map(({ label, segment }) => {
        return (
          <NavItem
            active={currentSegment === segment}
            agentId={agentId}
            key={label}
            label={label}
            segment={segment}
          />
        );
      })}
    </nav>
  );
};
