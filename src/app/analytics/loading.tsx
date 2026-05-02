export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between animate-pulse">
          <div>
            <div className="h-8 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
        <div className="h-48 bg-muted/30 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}
