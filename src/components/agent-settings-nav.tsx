"use client";

import type { Route } from "next";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Props {
  agentId: string;
}

const NAV_ITEMS = [{ label: "overview", segment: null }] satisfies {
  label: string;
  segment: null | string;
}[];

const CONFIG_ITEMS = [
  { label: "basics", segment: "basics" },
  { label: "prompt", segment: "prompt" },
  { label: "tools", segment: "tools" },
  { label: "sub-agents", segment: "sub-agents" },
  { label: "evals", segment: "evals" },
] satisfies { label: string; segment: string }[];

const BOTTOM_ITEMS = [
  { label: "versions", segment: "versions" },
  { label: "danger zone", segment: "danger" },
] satisfies { label: string; segment: string }[];

const navHref = (agentId: string, segment: null | string): Route => {
  return segment === null ? `/agents/${agentId}` : `/agents/${agentId}/${segment}`;
};

interface NavItemProps {
  active: boolean;
  href: Route;
  label: string;
}

const NavItem = ({ active, href, label }: NavItemProps) => {
  return (
    <Button
      asChild
      className="w-full justify-start"
      size="sm"
      variant={active ? "secondary" : "ghost"}
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
};

export const AgentSettingsNav = ({ agentId }: Props) => {
  const segment = useSelectedLayoutSegment();

  return (
    <nav className="flex w-48 shrink-0 flex-col gap-1 pt-1">
      {NAV_ITEMS.map(({ label, segment: s }) => {
        return (
          <NavItem active={segment === s} href={navHref(agentId, s)} key={label} label={label} />
        );
      })}

      <Separator className="my-2" />

      {CONFIG_ITEMS.map(({ label, segment: s }) => {
        return (
          <NavItem active={segment === s} href={navHref(agentId, s)} key={label} label={label} />
        );
      })}

      <Separator className="my-2" />

      {BOTTOM_ITEMS.map(({ label, segment: s }) => {
        return (
          <NavItem active={segment === s} href={navHref(agentId, s)} key={label} label={label} />
        );
      })}
    </nav>
  );
};
