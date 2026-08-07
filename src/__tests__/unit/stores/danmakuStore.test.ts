import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDanmakuStore } from '@/stores/danmakuStore'

const COUNTDOWN_SECONDS = 5

describe('danmakuStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useDanmakuStore.setState({ status: 'idle', showDanmaku: false, countdownValue: 5 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('counting 期间再次点击可取消；迟到的词库请求不会复活状态', async () => {
    let resolveFetch!: (v: unknown) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((r) => { resolveFetch = r })),
    )

    const firstToggle = useDanmakuStore.getState().toggle()
    expect(useDanmakuStore.getState().status).toBe('counting')
    expect(useDanmakuStore.getState().showDanmaku).toBe(true)

    await useDanmakuStore.getState().toggle()
    expect(useDanmakuStore.getState().status).toBe('idle')
    expect(useDanmakuStore.getState().showDanmaku).toBe(false)

    // 取消后才返回的词库请求：应被作废，不再设置 doneTimer
    resolveFetch({ json: () => Promise.resolve({ success: true, data: [{ word: 'x' }] }) })
    await firstToggle

    // 推进超过整个倒计时：状态不应被静默推成 active
    await vi.advanceTimersByTimeAsync((COUNTDOWN_SECONDS + 1) * 1000)
    expect(useDanmakuStore.getState().status).toBe('idle')
    expect(useDanmakuStore.getState().showDanmaku).toBe(false)
  })

  it('倒计时正常完成后进入 active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true, data: [{ word: 'x' }] }) })),
    )

    const t = useDanmakuStore.getState().toggle()
    expect(useDanmakuStore.getState().status).toBe('counting')
    expect(useDanmakuStore.getState().showDanmaku).toBe(true)

    await t
    await vi.advanceTimersByTimeAsync((COUNTDOWN_SECONDS + 1) * 1000)
    expect(useDanmakuStore.getState().status).toBe('active')
    expect(useDanmakuStore.getState().showDanmaku).toBe(true)
  })

  it('词库为空时倒计时结束后回到 idle 并关闭弹幕', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) })),
    )

    const t = useDanmakuStore.getState().toggle()
    await t
    await vi.advanceTimersByTimeAsync((COUNTDOWN_SECONDS + 1) * 1000)
    expect(useDanmakuStore.getState().status).toBe('empty')
    expect(useDanmakuStore.getState().showDanmaku).toBe(true)

    // EMPTY_RESET_MS(3000) 后自动复位
    await vi.advanceTimersByTimeAsync(3100)
    expect(useDanmakuStore.getState().status).toBe('idle')
    expect(useDanmakuStore.getState().showDanmaku).toBe(false)
  })
})
