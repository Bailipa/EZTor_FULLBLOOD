import { describe, expect, it } from 'vitest'
import {
  adoptMatchingPracticeRevision,
  decodePracticeDraft,
  hasPracticeDraftConflict,
  rebasePracticeDraft,
} from '@/features/study/practiceDraft'

describe('CET practice draft revisions', () => {
  it('restores versioned JSON drafts and marks legacy plain text as unbased', () => {
    expect(decodePracticeDraft('{"text":"local","revision":"rev-1"}')).toEqual({ text: 'local', revision: 'rev-1' })
    expect(decodePracticeDraft('local text')).toEqual({ text: 'local text', revision: null })
  })

  it('detects a stale local draft without treating equal text as a conflict', () => {
    const saved = { text: 'server', revision: 'rev-2' }
    expect(hasPracticeDraftConflict({ text: 'local', revision: 'rev-1' }, saved)).toBe(true)
    expect(hasPracticeDraftConflict({ text: 'server', revision: null }, saved)).toBe(false)
  })

  it('adopts the server revision only when text matches or the user explicitly rebases', () => {
    const local = { text: 'local', revision: 'rev-1' }
    const saved = { text: 'server', revision: 'rev-2' }
    expect(adoptMatchingPracticeRevision(local, saved)).toEqual(local)
    expect(rebasePracticeDraft(local, saved)).toEqual({ text: 'local', revision: 'rev-2' })
    expect(adoptMatchingPracticeRevision({ text: 'server', revision: null }, saved)).toEqual({ text: 'server', revision: 'rev-2' })
  })
})
