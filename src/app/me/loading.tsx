import AppLayout from '@/components/layout/AppLayout'

export default function SettingsLoading() {
  return (
    <AppLayout>
      <main data-workspace-page className="min-h-screen p-4 md:p-6" aria-busy="true" aria-label="正在打开设置">
        <div className="mx-auto md:max-w-none max-w-5xl space-y-6">
          <h1 className="text-2xl font-semibold md:hidden">设置</h1>
          <div className="grid gap-6 md:grid-cols-2"><div className="h-64 rounded-xl border bg-card" /><div className="h-48 rounded-xl border bg-card" /></div>
        </div>
      </main>
    </AppLayout>
  )
}
