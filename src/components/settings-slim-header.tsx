"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

type Segment = "account" | "appearance" | "connections" | "memory";

interface SectionLink {
  href: `/settings/${Segment}`;
  label: string;
  segment: Segment;
}

const SECTIONS = [
  { href: "/settings/account", label: "account", segment: "account" },
  { href: "/settings/connections", label: "connections", segment: "connections" },
  { href: "/settings/memory", label: "memory", segment: "memory" },
  { href: "/settings/appearance", label: "appearance", segment: "appearance" },
] satisfies SectionLink[];

export const SettingsSlimHeader = () => {
  const segment = useSelectedLayoutSegment() ?? "account";

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      <SidebarTrigger />
      <NavigationMenu viewport={false}>
        <NavigationMenuList>
          {SECTIONS.map((section) => {
            return (
              <NavigationMenuItem key={section.segment}>
                <NavigationMenuLink active={section.segment === segment} asChild>
                  <Link href={section.href}>{section.label}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
};
