"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

type Segment = "account" | "appearance" | "memory";

interface SectionLink {
  href: `/settings/${Segment}`;
  label: string;
  segment: Segment;
}

const SECTIONS = [
  { href: "/settings/account", label: "account", segment: "account" },
  { href: "/settings/memory", label: "memory", segment: "memory" },
  { href: "/settings/appearance", label: "appearance", segment: "appearance" },
] satisfies SectionLink[];

export const SettingsSlimHeader = () => {
  const segment = useSelectedLayoutSegment() ?? "account";

  return (
    <header className="flex h-10 shrink-0 items-center border-b ps-12 pe-4 sm:ps-14 sm:pe-6">
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
