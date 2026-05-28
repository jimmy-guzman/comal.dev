"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { cn } from "@/lib/utils";

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
  const segment = useSelectedLayoutSegment();

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b ps-12 pe-4 sm:ps-14 sm:pe-6">
      <nav aria-label="settings sections" className="flex items-center gap-1">
        {SECTIONS.map((section) => {
          const isActive = section.segment === segment;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-md px-2 py-1 text-sm transition-colors",
                isActive
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground",
              )}
              href={section.href}
              key={section.segment}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
};
