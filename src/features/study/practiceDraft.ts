export type PracticeDraft = { text: string; revision: string | null }
export type SavedPracticeWork = { text: string; revision: string } | undefined

export function decodePracticeDraft(raw: string): PracticeDraft {
  try {
    const value: unknown = JSON.parse(raw)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const draft = value as Record<string, unknown>
      if (typeof draft.text === 'string' && (typeof draft.revision === 'string' || draft.revision === null)) {
        return { text: draft.text, revision: draft.revision }
      }
    }
  } catch { /* Older drafts were stored as plain text. */ }
  return { text: raw, revision: null }
}

export function hasPracticeDraftConflict(draft: PracticeDraft, saved: SavedPracticeWork): boolean {
  return draft.text !== (saved?.text ?? '') && draft.revision !== (saved?.revision ?? null)
}

export function adoptMatchingPracticeRevision(draft: PracticeDraft, saved: SavedPracticeWork): PracticeDraft {
  if (draft.text !== (saved?.text ?? '')) return draft
  if (draft.revision === (saved?.revision ?? null)) return draft
  return { ...draft, revision: saved?.revision ?? null }
}

export function rebasePracticeDraft(draft: PracticeDraft, saved: SavedPracticeWork): PracticeDraft {
  return { ...draft, revision: saved?.revision ?? null }
}

export const practiceDraftCodec = {
  encode: (draft: PracticeDraft) => draft.text ? JSON.stringify(draft) : null,
  decode: decodePracticeDraft,
  isEmpty: (draft: PracticeDraft) => !draft.text,
}
