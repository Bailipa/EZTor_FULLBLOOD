import { studyApi } from '@/services/study/api'
import { studyMaterials, studyMaterialSummary } from '@/services/study/MaterialService'
export async function GET(req: Request) {
  const summary = new URL(req.url).searchParams.get('summary') === '1'
  return studyApi(req, async (userId) => summary ? studyMaterialSummary(userId) : studyMaterials(userId))
}
