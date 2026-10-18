import { Skeleton } from "@/components/ui/skeleton";

export function AuthFormSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
