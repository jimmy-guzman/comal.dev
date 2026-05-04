import { tools } from "@/agents/tools/registry";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ToolsPage() {
  const grouped = tools.listByGroup();

  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">tools</h1>

      {grouped.map(({ group, items }) => {
        return (
          <section className="flex flex-col gap-4" key={group.id}>
            <h2 className="text-lg font-medium">{group.label}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((tool) => {
                return (
                  <Card key={tool.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{tool.name}</CardTitle>
                        <Badge variant="secondary">{tool.access}</Badge>
                      </div>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
