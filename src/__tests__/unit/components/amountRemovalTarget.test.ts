import { describe, it, expect } from 'vitest'
import { amountRemovalTarget, danmakuPollInterval } from '@/components/ui/danmaku'

describe('amountRemovalTarget', () => {
  it('调小：按本次变化比例移除', () => {
    // 2x → 0.5x：一次降到 1/4
    expect(amountRemovalTarget(16, 0.5, 2)).toBe(4)
    // 1x → 0.5x：减半
    expect(amountRemovalTarget(16, 0.5, 1)).toBe(8)
    expect(amountRemovalTarget(9, 0.5, 1)).toBe(5) // round(4.5)
  })

  it('连续调小（拖动滑块）按每步比例累积，不把已缩小的数量再乘', () => {
    let count = 16
    let amount = 1
    for (const next of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      count = amountRemovalTarget(count, next, amount)
      amount = next
    }
    // 16 × 0.5/1 = 8：不因中间步骤被踩低（旧公式会一路相乘到 2）
    expect(count).toBe(8)
  })

  it('调大/不变：不做移除', () => {
    expect(amountRemovalTarget(8, 1, 0.5)).toBe(8)
    expect(amountRemovalTarget(8, 0.5, 0.5)).toBe(8)
  })
})

describe('danmakuPollInterval', () => {
  it('间隔随速度自适应（∝1/speed）：低速拉长、高速缩短，在屏数量不因调速累积', () => {
    expect(danmakuPollInterval(1)).toBe(12000) // 基准
    expect(danmakuPollInterval(0.5)).toBe(24000) // 慢→间隔翻倍
    expect(danmakuPollInterval(2)).toBe(6000) // 快→间隔减半
    expect(danmakuPollInterval(4)).toBe(3000) // 下限 3s 防刷
  })
})
