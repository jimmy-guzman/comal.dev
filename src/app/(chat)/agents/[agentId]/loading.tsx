import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const ROW_COUNT = 5;

export default function AgentDetailLoading() {
  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-7 w-48 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="size-9 rounded-md" />
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: ROW_COUNT }, (_, i) => {
          return (
            <div key={i}>
              {i > 0 ? <Separator className="my-2" /> : null}
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <div className="flex flex-1 flex-col gap-1">
                  <Skeleton className="h-3.5 w-3/5 rounded-md" />
                  <Skeleton className="h-3 w-2/5 rounded-md" />
                </div>
                <Skeleton className="size-8 shrink-0 rounded-md" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
