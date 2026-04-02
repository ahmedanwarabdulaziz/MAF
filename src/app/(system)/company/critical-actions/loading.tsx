export default function CriticalActionsLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Page Header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="h-8 w-64 bg-background-secondary rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-background-secondary rounded mt-2 animate-pulse" />
        </div>
        <div className="h-14 w-20 bg-red-50 rounded-xl animate-pulse" />
      </div>

      {/* KPI Strip skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-border bg-white px-5 py-4 animate-pulse"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-background-secondary rounded" />
              <div className="h-3 w-24 bg-background-secondary rounded" />
            </div>
            <div className="h-8 w-16 bg-background-secondary rounded" />
          </div>
        ))}
      </div>

      {/* Filter Bar skeleton */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-border px-5 py-3 shadow-sm animate-pulse">
        <div className="h-4 w-12 bg-background-secondary rounded" />
        <div className="h-8 w-36 bg-background-secondary rounded-lg" />
        <div className="h-8 w-36 bg-background-secondary rounded-lg" />
      </div>

      {/* Section skeletons */}
      {[1, 2, 3].map(section => (
        <div key={section}>
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-6 w-6 bg-background-secondary rounded animate-pulse" />
            <div className="h-5 w-48 bg-background-secondary rounded animate-pulse" />
          </div>
          {/* Card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1, 2, 3].map(card => (
              <div
                key={card}
                className="rounded-xl border border-border bg-white p-4 animate-pulse"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="h-3 w-20 bg-background-secondary rounded" />
                  <div className="h-4 w-10 bg-background-secondary rounded-full" />
                </div>
                <div className="h-4 w-full bg-background-secondary rounded mb-2" />
                <div className="h-3 w-3/4 bg-background-secondary rounded mb-3" />
                <div className="flex justify-between pt-2 border-t border-border/30">
                  <div className="h-3 w-20 bg-background-secondary rounded" />
                  <div className="h-3 w-16 bg-background-secondary rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
