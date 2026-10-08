// Narrow erratum verified against .local-cet-import/source-ocr-en/2880977bc0a8b730800d3104.txt.
// Run with the test runtime's Prisma client; default is read-only inspection.
const { PrismaClient } = require('@prisma/client')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const db = new PrismaClient()
const slug = 'cet4-2025-06-set1-full'
const passageId = 'cet4-2025-06-set1-bank'
const mode = process.env.EZTOR_CONSTRUCT_FIX_MODE || 'inspect'
const snapshotPath = process.env.EZTOR_CONSTRUCT_FIX_SNAPSHOT
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function read(client) {
  const papers = await client.examPaper.findMany({ where: { slug }, orderBy: { version: 'asc' } })
  assert.equal(papers.length, 1, 'Expected one reviewed paper version')
  const attempts = await client.examAttempt.findMany({ where: { paperId: papers[0].id }, orderBy: { id: 'asc' } })
  return { paper: papers[0], attempts }
}
function repair(snapshot) {
  const content = structuredClone(snapshot.paper.content)
  const passage = content.READING.passages.find(p => p.id === passageId)
  assert.ok(passage)
  const match = /how we construc( {2,})t our identities/.exec(passage.text)
  if (!match) { assert.ok(passage.text.includes('how we construct our identities')); return null }
  assert.equal(match[1].length, 19, 'Unexpected text; stop for review')
  const wordStart = match.index + 'how we '.length
  const removedStart = wordStart + 'construc'.length
  const removedEnd = removedStart + match[1].length
  const oldWordEnd = removedEnd + 1
  const oldText = passage.text
  passage.text = oldText.slice(0, removedStart) + oldText.slice(removedEnd)
  const position = offset => offset - Math.max(0, Math.min(match[1].length, offset - removedStart))
  let shifted = 0, expanded = 0
  const attempts = snapshot.attempts.map(attempt => {
    const state = structuredClone(attempt.state)
    for (const field of ['readingMarks', 'readingHighlights']) {
      if (!Array.isArray(state[field])) continue
      state[field] = state[field].map(mark => {
        if (mark.passageId !== passageId) return mark
        assert.equal(oldText.slice(mark.start, mark.end), mark.text, 'Existing mark inconsistent; stop')
        let start = position(mark.start), end = position(mark.end)
        if (field === 'readingHighlights' && mark.start < oldWordEnd && mark.end > wordStart) {
          start = wordStart; end = wordStart + 'construct'.length; expanded++
        }
        const next = { ...mark, start, end, text: passage.text.slice(start, end) }
        assert.ok(next.text.trim(), 'Correction would empty a saved mark')
        if (JSON.stringify(next) !== JSON.stringify(mark)) shifted++
        return next
      }).filter((mark, index, all) => all.findIndex(other => other.passageId === mark.passageId && other.start === mark.start && other.end === mark.end) === index)
    }
    return { id: attempt.id, revision: attempt.revision + 1, state }
  })
  // Recreate the import hash fields in their original order; content includes the corrected text.
  const p = snapshot.paper
  const hashInput = { slug: p.slug, version: p.version, level: p.level, kind: p.kind, originType: p.originType, title: p.title, sourceName: p.sourceName, sourceUrl: p.sourceUrl, rightsHolder: p.rightsHolder, rightsEvidence: p.rightsEvidence, content }
  return { content, contentHash: digest(hashInput), attempts, shifted, expanded, removedCharacters: match[1].length }
}
;(async () => {
  assert.equal(new URL(process.env.DATABASE_URL).pathname, '/eztor_test', 'This correction targets only the test database')
  const current = await read(db)
  const patch = repair(current)
  if (!patch) { console.log(JSON.stringify({ alreadyCorrect: true })); return }
  if (mode === 'snapshot') {
    assert.ok(snapshotPath)
    const fd = fs.openSync(snapshotPath, 'wx', 0o600)
    try { fs.writeFileSync(fd, JSON.stringify(current)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  } else if (mode === 'apply') {
    assert.ok(snapshotPath)
    const before = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    await db.$transaction(async tx => {
      const ids = [...new Set(before.attempts.map(a => a.userId))].sort()
      for (const id of ids) await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM "ExamPaper" WHERE id=${before.paper.id} FOR UPDATE`
      const live = JSON.parse(JSON.stringify(await read(tx)))
      assert.equal(digest(live), digest(before), 'Paper or attempts changed after backup; stop and take a fresh snapshot')
      const change = repair(live)
      assert.ok(change)
      await tx.examPaper.update({ where: { id: live.paper.id }, data: { content: change.content, contentHash: change.contentHash } })
      for (const attempt of change.attempts) await tx.examAttempt.update({ where: { id: attempt.id }, data: { state: attempt.state, revision: attempt.revision } })
      await tx.auditLog.create({ data: { action: 'EXAM_TEXT_CORRECTION', entityType: 'EXAM_PAPER', entityId: live.paper.id,
        oldValue: JSON.stringify({ contentHash: live.paper.contentHash }), newValue: JSON.stringify({ batch: 'construct-spacing-20261008', contentHash: change.contentHash, passageId, removedCharacters: change.removedCharacters, attempts: change.attempts.length, shiftedMarks: change.shifted, expandedHighlights: change.expanded }) } })
    })
    const after = await read(db)
    assert.equal(after.paper.content.READING.passages.find(p => p.id === passageId).text, patch.content.READING.passages.find(p => p.id === passageId).text)
    assert.equal(after.attempts.length, current.attempts.length)
  } else assert.equal(mode, 'inspect')
  console.log(JSON.stringify({ mode, paperId: current.paper.id, attempts: patch.attempts.length, shiftedMarks: patch.shifted, expandedHighlights: patch.expanded, removedCharacters: patch.removedCharacters, previousHash: current.paper.contentHash, nextHash: patch.contentHash }))
})().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => db.$disconnect())
