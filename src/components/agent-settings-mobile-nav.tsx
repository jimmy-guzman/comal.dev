"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";

interface Props {
  agentId: string;
}

const NAV_ITEMS = [
  { label: "overview", segment: null },
  { label: "cost", segment: "cost" },
] as const;

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

const ALL_ITEMS = [...NAV_ITEMS, ...CONFIG_ITEMS, ...BOTTOM_ITEMS];

export const AgentSettingsMobileNav = ({ agentId }: Props) => {
  const segment = useSelectedLayoutSegment();
  const [open, setOpen] = useState(false);

  const currentLabel = ALL_ITEMS.find((item) => item.segment === segment)?.label ?? "overview";

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <DrawerTrigger asChild>
        <Button className="shrink-0 gap-1 sm:hidden" size="sm" variant="ghost">
          {currentLabel}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerTitle className="sr-only">agent navigation</DrawerTitle>
        <nav className="flex flex-col gap-1 p-4">
          {NAV_ITEMS.map(({ label, segment: s }) => {
            return (
              <Button
                asChild
                className="w-full justify-start"
                key={label}
                onClick={() => {
                  setOpen(false);
                }}
                size="sm"
                variant={segment === s ? "secondary" : "ghost"}
              >
                <Link href={s === null ? `/agents/${agentId}` : `/agents/${agentId}/${s}`}>
                  {label}
                </Link>
              </Button>
            );
          })}

          <Separator className="my-2" />

          {CONFIG_ITEMS.map(({ label, segment: s }) => {
            return (
              <Button
                asChild
                className="w-full justify-start"
                key={label}
                onClick={() => {
                  setOpen(false);
                }}
                size="sm"
                variant={segment === s ? "secondary" : "ghost"}
              >
                <Link href={`/agents/${agentId}/${s}`}>{label}</Link>
              </Button>
            );
          })}

          <Separator className="my-2" />

          {BOTTOM_ITEMS.map(({ label, segment: s }) => {
            return (
              <Button
                asChild
                className="w-full justify-start"
                key={label}
                onClick={() => {
                  setOpen(false);
                }}
                size="sm"
                variant={segment === s ? "secondary" : "ghost"}
              >
                <Link href={`/agents/${agentId}/${s}`}>{label}</Link>
              </Button>
            );
          })}
        </nav>
      </DrawerContent>
    </Drawer>
  );
};
