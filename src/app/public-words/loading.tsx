export default function PublicWordsLoading() {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-muted rounded-full" />
            <div>
              <div className="h-7 w-36 bg-muted rounded mb-2" />
              <div className="h-4 w-56 bg-muted rounded" />
            </div>
          </div>
        </div>
        <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}
