import { Skeleton } from "@/components/ui/skeleton";

// Shown inside the app shell while a /app page is loading, so the sidebar and header never
// disappear. Once pages fetch real data (Phase 3+), this is what users see during the fetch.
export default function AppLoading() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
