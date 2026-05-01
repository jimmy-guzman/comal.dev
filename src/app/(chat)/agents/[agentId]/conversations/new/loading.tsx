import { Skeleton } from "@/components/ui/skeleton";

export default function NewConversationLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end border-b px-4 py-2">
        <div className="h-8" />
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
      </div>
      <div className="pb-safe-or-4 flex flex-col gap-2 border-t p-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </div>
  );
}
