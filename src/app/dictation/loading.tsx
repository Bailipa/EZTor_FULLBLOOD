export default function DictationLoading() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-muted rounded-full" />
            <div>
              <div className="h-7 w-40 bg-muted rounded mb-2" />
              <div className="h-4 w-56 bg-muted rounded" />
            </div>
          </div>
        </div>
        <div className="border-2 shadow-sm rounded-lg animate-pulse">
          <div className="p-8 md:p-12 space-y-8">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-20 w-20 bg-muted rounded-full mx-auto" />
            <div className="h-14 bg-muted/30 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
