import { parseAnalysisReport, type ExamAnalysisView } from './examAnalysis'
export type LocalExamAnalysis = { report: NonNullable<ExamAnalysisView['report']>; token?: string }
export const localExamAnalysisKey = (accountId: string, paperKey: string) => `cet-analysis:v1:${accountId}:${paperKey}`
export function readLocalExamAnalysis(storage: Pick<Storage, 'getItem'>, key: string): LocalExamAnalysis | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw)
    const report = parseAnalysisReport(value.report)
    if (typeof value.report.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.report.generatedAt))) return null
    return { report: { ...report, generatedAt: value.report.generatedAt }, ...(typeof value.token === 'string' ? { token: value.token } : {}) }
  } catch { return null }
}
export function saveLocalExamAnalysis(storage: Pick<Storage, 'setItem' | 'getItem'>, key: string, value: LocalExamAnalysis) {
  const encoded = JSON.stringify(value)
  storage.setItem(key, encoded)
  if (storage.getItem(key) !== encoded) throw new Error('浏览器未保存分析，请检查本地存储空间')
}
