import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end border-b px-4 py-2">
        <Skeleton className="size-8 rounded-md" />
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-hidden p-4">
        <div className="flex justify-end">
          <Skeleton className="h-16 w-2/3 rounded-md" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="h-4 w-4/6 rounded-md" />
          <Skeleton className="h-4 w-3/6 rounded-md" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-12 w-1/2 rounded-md" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-4/6 rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
        </div>
      </div>
      <div className="pb-safe-or-4 flex flex-col gap-2 border-t p-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </div>
  );
}
