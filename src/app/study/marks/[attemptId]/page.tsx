import { redirect } from 'next/navigation'
export default async function MarkSourcePage({ params, searchParams }: {
  params: Promise<{ attemptId: string }>
  searchParams: Promise<{ passageId?: string; start?: string; end?: string }>
}) {
  const { attemptId } = await params
  const query = await searchParams
  redirect(`/study?${new URLSearchParams({ attemptId, passageId: query.passageId ?? '', start: query.start ?? '', end: query.end ?? '' })}`)
}
