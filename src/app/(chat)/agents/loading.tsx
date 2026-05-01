import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_COUNT = 6;

export default function AgentsLoading() {
  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <Skeleton className="h-8 w-40 rounded-md" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => {
          return (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-4/6 rounded-md" />
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
