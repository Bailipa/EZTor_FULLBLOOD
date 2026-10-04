export default function TranslationLoading() {
  return (
    <main className="min-h-screen p-4 md:ml-[72px] md:p-8 xl:ml-[208px]" aria-busy="true" aria-label="正在打开翻译">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-semibold">翻译</h1>
        <div className="h-11 w-56 rounded bg-muted" />
        <div className="h-52 rounded-xl border bg-card" />
      </div>
    </main>
  )
}
