import type { SearchParams } from "nuqs/server";

import { tools } from "@/agents/tools/registry";
import { toolSearchParamsCache } from "@/app/(app)/(workspace)/tools/search-params";
import { FloatingSidebarTrigger } from "@/components/floating-sidebar-trigger";
import { ToolsFilter } from "@/components/tools-filter";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function ToolsPage({ searchParams }: Props) {
  const { group: groupFilter, q } = await toolSearchParamsCache.parse(searchParams);

  const needle = q.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(needle);

  const grouped = tools
    .listByGroup()
    .map(({ group, items }) => {
      return {
        group,
        items: items.filter((tool) => {
          if (groupFilter !== null && tool.group !== groupFilter) return false;

          if (needle === "") return true;

          return matches(tool.name) || matches(tool.description) || matches(tool.id);
        }),
      };
    })
    .filter(({ items }) => items.length > 0);

  const groupOptions = tools.groups().map((g) => ({ id: g.id, label: g.label }));

  return (
    <>
      <FloatingSidebarTrigger />
      <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">tools</h1>
          <span aria-hidden className="min-w-22" />
        </div>

        <ToolsFilter groups={groupOptions} />

        {grouped.length === 0 ? (
          <p className="text-muted-foreground text-sm">no tools match.</p>
        ) : (
          grouped.map(({ group, items }) => {
            return (
              <section className="flex flex-col gap-4" key={group.id}>
                <h2 className="text-lg font-medium">{group.label}</h2>
                <ItemGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((tool) => {
                    return (
                      <Item className="h-full" key={tool.id} variant="outline">
                        <ItemContent>
                          <div className="flex items-start justify-between gap-2">
                            <ItemTitle>{tool.name}</ItemTitle>
                            <Badge className="shrink-0" variant="secondary">
                              {tool.access}
                            </Badge>
                          </div>
                          <ItemDescription>{tool.description}</ItemDescription>
                        </ItemContent>
                      </Item>
                    );
                  })}
                </ItemGroup>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
