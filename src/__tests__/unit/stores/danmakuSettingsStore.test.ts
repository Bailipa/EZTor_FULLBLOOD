import { describe, it, expect, beforeEach } from 'vitest'
import {
  useDanmakuSettingsStore,
  DANMAKU_SETTINGS_DEFAULTS,
} from '@/stores/danmakuSettingsStore'

describe('danmakuSettingsStore', () => {
  beforeEach(() => {
    useDanmakuSettingsStore.setState(DANMAKU_SETTINGS_DEFAULTS)
  })

  it('默认值为 speed 1 / amount 1 / opacity 80 / size 1', () => {
    const s = useDanmakuSettingsStore.getState()
    expect(s.speed).toBe(1)
    expect(s.amount).toBe(1)
    expect(s.opacity).toBe(80)
    expect(s.size).toBe(1)
  })

  it('setSpeed / setAmount / setOpacity / setSize 写入并限制在合理范围', () => {
    useDanmakuSettingsStore.getState().setSpeed(2)
    expect(useDanmakuSettingsStore.getState().speed).toBe(2)

    // 越界收敛到上下限
    useDanmakuSettingsStore.getState().setSpeed(99)
    expect(useDanmakuSettingsStore.getState().speed).toBe(2)
    useDanmakuSettingsStore.getState().setAmount(0)
    expect(useDanmakuSettingsStore.getState().amount).toBe(0.5)
    useDanmakuSettingsStore.getState().setOpacity(150)
    expect(useDanmakuSettingsStore.getState().opacity).toBe(100)
    useDanmakuSettingsStore.getState().setOpacity(-3)
    expect(useDanmakuSettingsStore.getState().opacity).toBe(0)
    useDanmakuSettingsStore.getState().setSize(0)
    expect(useDanmakuSettingsStore.getState().size).toBe(0.5)
    useDanmakuSettingsStore.getState().setSize(9)
    expect(useDanmakuSettingsStore.getState().size).toBe(2)

    // 小数步进取整到 0.1
    useDanmakuSettingsStore.getState().setSpeed(1.37)
    expect(useDanmakuSettingsStore.getState().speed).toBe(1.4)
    useDanmakuSettingsStore.getState().setOpacity(37)
    expect(useDanmakuSettingsStore.getState().opacity).toBe(37)
  })

  it('reset 恢复默认', () => {
    useDanmakuSettingsStore.setState({ speed: 1.5, amount: 2, opacity: 20, size: 1.5 })
    useDanmakuSettingsStore.getState().reset()
    const s = useDanmakuSettingsStore.getState()
    expect(s.speed).toBe(DANMAKU_SETTINGS_DEFAULTS.speed)
    expect(s.amount).toBe(DANMAKU_SETTINGS_DEFAULTS.amount)
    expect(s.opacity).toBe(DANMAKU_SETTINGS_DEFAULTS.opacity)
    expect(s.size).toBe(DANMAKU_SETTINGS_DEFAULTS.size)
  })
})
