/**
 * 借鉴 Anki 的间隔重复（SM-2 精简版）。
 *
 * 记忆模型：
 *  - repetitions: 连续答对次数（答错清零）
 *  - intervalDays: 当前间隔天数
 *  - ease: 难度系数（答对缓慢上升、答错 -0.15，下限 1.3）
 *  - lapses: 遗忘次数
 *  - dueDate: 下次到期时间（到期才进入复习队列）
 */

export interface SrsState {
  repetitions: number
  intervalDays: number
  ease: number
  lapses: number
  dueDate: Date | null
}

const MIN_EASE = 1.3
const EASE_DECAY = 0.15
const LAPSE_REVIEW_MINUTES = 10

/** 答对后的间隔（天）序列：1、2、4、7、15、30、60... */
function nextInterval(repetitions: number, prevIntervalDays: number, ease: number): number {
  if (repetitions <= 0) return 0
  if (repetitions === 1) return 1
  if (repetitions === 2) return 2
  if (repetitions === 3) return 4
  if (repetitions === 4) return 7
  if (repetitions === 5) return 15
  const grown = Math.round(prevIntervalDays * ease)
  return Math.min(60, Math.max(30, grown))
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function applyReview(
  state: SrsState,
  isCorrect: boolean,
  now: Date = new Date(),
): Partial<SrsState> {
  if (isCorrect) {
    const repetitions = state.repetitions + 1
    const intervalDays = nextInterval(repetitions, state.intervalDays, state.ease)
    return {
      repetitions,
      intervalDays,
      dueDate: addDays(now, intervalDays),
      ease: Math.max(MIN_EASE, state.ease),
    }
  }

  // 答错：遗忘 → 重置进度，10 分钟后重见
  return {
    repetitions: 0,
    intervalDays: 0,
    lapses: state.lapses + 1,
    ease: Math.max(MIN_EASE, state.ease - EASE_DECAY),
    dueDate: addMinutes(now, LAPSE_REVIEW_MINUTES),
  }
}

export const SRS_DEFAULTS: SrsState = {
  repetitions: 0,
  intervalDays: 0,
  ease: 2.5,
  lapses: 0,
  dueDate: null,
}
