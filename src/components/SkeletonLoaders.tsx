import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/60",
        className
      )}
    />
  );
}

export function LessonsSkeleton() {
  return (
    <div className="page-container space-y-4">
      <Skeleton className="h-8 w-48" />
      {[1, 2, 3].map(i => (
        <div key={i} className="card-academic p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuizzesSkeleton() {
  return (
    <div className="page-container space-y-4">
      <Skeleton className="h-8 w-48" />
      {[1, 2, 3].map(i => (
        <div key={i} className="card-academic p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="page-container space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card-academic p-4 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card-academic p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-32 w-full rounded-full" />
            <Skeleton className="h-4 w-20 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnnouncementsSkeleton() {
  return (
    <div className="page-container space-y-4">
      <Skeleton className="h-8 w-32" />
      {[1, 2, 3].map(i => (
        <div key={i} className="card-academic p-4 space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
