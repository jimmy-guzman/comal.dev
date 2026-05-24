import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Item, ItemContent, ItemGroup } from "@/components/ui/item";

type Segment =
  | "basics"
  | "cost"
  | "danger"
  | "evals"
  | "prompt"
  | "sub-agents"
  | "tools"
  | "versions";

interface SectionItem {
  label: string;
  segment: Segment;
}

interface SectionGroup {
  items: SectionItem[];
  label: string;
}

const GROUPS = [
  {
    items: [
      { label: "basics", segment: "basics" },
      { label: "prompt", segment: "prompt" },
      { label: "tools", segment: "tools" },
      { label: "sub-agents", segment: "sub-agents" },
      { label: "evals", segment: "evals" },
    ],
    label: "configure",
  },
  {
    items: [{ label: "cost", segment: "cost" }],
    label: "usage",
  },
  {
    items: [
      { label: "versions", segment: "versions" },
      { label: "danger zone", segment: "danger" },
    ],
    label: "history & admin",
  },
] satisfies SectionGroup[];

const SYSTEM_ACCESSIBLE_SEGMENTS = new Set<Segment>(["cost"]);

interface Props {
  agentId: string;
  isSystem: boolean;
}

const hrefFor = (agentId: string, segment: Segment) => {
  switch (segment) {
    case "basics": {
      return `/agents/${agentId}/basics` as const;
    }
    case "cost": {
      return `/agents/${agentId}/cost` as const;
    }
    case "danger": {
      return `/agents/${agentId}/danger` as const;
    }
    case "evals": {
      return `/agents/${agentId}/evals` as const;
    }
    case "prompt": {
      return `/agents/${agentId}/prompt` as const;
    }
    case "sub-agents": {
      return `/agents/${agentId}/sub-agents` as const;
    }
    case "tools": {
      return `/agents/${agentId}/tools` as const;
    }
    case "versions": {
      return `/agents/${agentId}/versions` as const;
    }
    default: {
      segment satisfies never;

      throw new Error("unknown agent section");
    }
  }
};

const SectionRow = ({ agentId, item }: { agentId: string; item: SectionItem }) => {
  return (
    <Item asChild className="px-4 py-3" variant="outline">
      <Link href={hrefFor(agentId, item.segment)}>
        <ItemContent>
          <p className="text-sm font-medium">{item.label}</p>
        </ItemContent>
        <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
      </Link>
    </Item>
  );
};

export const AgentSectionDirectory = ({ agentId, isSystem }: Props) => {
  const groups = isSystem
    ? GROUPS.map((g) => {
        return {
          ...g,
          items: g.items.filter((i) => SYSTEM_ACCESSIBLE_SEGMENTS.has(i.segment)),
        };
      }).filter((g) => g.items.length > 0)
    : GROUPS;

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        return (
          <div className="flex flex-col gap-2" key={group.label}>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">{group.label}</p>
            <ItemGroup className="gap-2">
              {group.items.map((item) => {
                return <SectionRow agentId={agentId} item={item} key={item.segment} />;
              })}
            </ItemGroup>
          </div>
        );
      })}
    </div>
  );
};
