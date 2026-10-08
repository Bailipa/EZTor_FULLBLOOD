import { studyApi } from '@/services/study/api'
import { readingMarks, readingMarkSource } from '@/services/study/ReadingMarkService'
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams
  return studyApi(req, (userId) => query.has('attemptId')
    ? readingMarkSource(userId, query.get('attemptId')!, query.get('passageId') ?? '', Number(query.get('start')), Number(query.get('end')))
    : readingMarks(userId, query.get('cursor')))
}
