export default function HistoryLoading() {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="bg-white dark:bg-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-muted rounded-full" />
            <div>
              <div className="h-7 w-36 bg-muted rounded mb-2" />
              <div className="h-4 w-48 bg-muted rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
