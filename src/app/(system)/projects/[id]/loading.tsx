// PERF-01: Route-level loading skeleton for all /projects/[id]/* pages.
// Shown by Next.js App Router while the server component is fetching data.
// Replaces the blank white screen users see during project page transitions.

export default function ProjectLoading() {
  return (
    <div className="animate-pulse space-y-6 p-8" dir="rtl">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 rounded bg-border" />
        <div className="h-4 w-2 rounded bg-border" />
        <div className="h-4 w-32 rounded bg-border" />
      </div>

      {/* Page title */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-border" />
          <div className="h-4 w-32 rounded bg-border/60" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-border" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-background p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-border" />
            <div className="h-7 w-36 rounded bg-border" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="border-b border-border bg-background-secondary px-6 py-3 flex gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-border" style={{ width: `${60 + i * 15}px` }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-border/50 px-6 py-4 flex gap-6 items-center">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-3 rounded bg-border/60" style={{ width: `${50 + j * 20}px` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
