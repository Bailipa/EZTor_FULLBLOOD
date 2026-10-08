import VocabularyWorkspace from '@/components/vocabulary/VocabularyWorkspace'

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const query = await searchParams
  return <VocabularyWorkspace initialPanel={query.view === 'marks' ? 'marks' : 'history'} />
}
