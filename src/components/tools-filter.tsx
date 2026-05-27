"use client";

import { useQueryState } from "nuqs";

import { toolSearchParams } from "@/app/(chat)/tools/search-params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Group {
  id: string;
  label: string;
}

interface Props {
  groups: Group[];
}

export const ToolsFilter = ({ groups }: Props) => {
  const [q, setQ] = useQueryState("q", toolSearchParams.q.withOptions({ shallow: false }));
  const [group, setGroup] = useQueryState(
    "group",
    toolSearchParams.group.withOptions({ shallow: false }),
  );

  return (
    <div className="flex flex-col gap-3">
      <Input
        aria-label="search tools"
        onChange={(event) => {
          void setQ(event.target.value);
        }}
        placeholder="search tools..."
        type="search"
        value={q}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-pressed={group === null}
          className="h-7 text-xs"
          onClick={() => {
            void setGroup(null);
          }}
          size="sm"
          variant={group === null ? "secondary" : "ghost"}
        >
          all
        </Button>
        {groups.map((g) => {
          const isActive = group === g.id;

          return (
            <Button
              aria-pressed={isActive}
              className="h-7 text-xs"
              key={g.id}
              onClick={() => {
                void setGroup(isActive ? null : g.id);
              }}
              size="sm"
              variant={isActive ? "secondary" : "ghost"}
            >
              {g.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
