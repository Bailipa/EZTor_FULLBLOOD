import AppLayout from '@/components/layout/AppLayout'
import StudyWorkspace from '@/features/study/StudyWorkspace'
export default async function StudyPage({ searchParams }: { searchParams: Promise<{ view?: string; examId?: string; attemptId?: string; passageId?: string; start?: string; end?: string }> }) {
  const query = await searchParams
  return <AppLayout><StudyWorkspace showMaterials={query.view === 'materials'} showEvidence={query.view === 'evidence'} examId={query.examId} markTarget={query.attemptId ? { attemptId: query.attemptId, passageId: query.passageId ?? '', start: query.start ?? '', end: query.end ?? '' } : undefined} /></AppLayout>
}
