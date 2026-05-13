import { tools } from "@/agents/tools/registry";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";

export default function ToolsPage() {
  const grouped = tools.listByGroup();

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">tools</h1>
        <span aria-hidden className="min-w-22" />
      </div>

      {grouped.map(({ group, items }) => {
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
      })}
    </div>
  );
}
