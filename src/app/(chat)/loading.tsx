import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <Skeleton className="h-8 w-48 rounded-md" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-5/6 rounded-md" />
        <Skeleton className="h-16 w-4/6 rounded-md" />
      </div>
    </div>
  );
}
