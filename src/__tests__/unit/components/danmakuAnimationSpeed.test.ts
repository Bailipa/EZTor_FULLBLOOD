import { afterEach, describe, expect, it } from 'vitest'
import { setDanmakuAnimationsSpeed } from '@/components/ui/danmaku'
import { useDanmakuSettingsStore } from '@/stores/danmakuSettingsStore'

function animation() {
  return { playbackRate: 0 } as Animation
}

describe('setDanmakuAnimationsSpeed', () => {
  afterEach(() => useDanmakuSettingsStore.getState().reset())

  it('批量更新在途弹幕的所有动画速度', () => {
    const bullets = [[animation(), animation()], [animation(), animation()]]

    setDanmakuAnimationsSpeed(bullets, 1.6)

    expect(bullets.flat().map((item) => item.playbackRate)).toEqual([1.6, 1.6, 1.6, 1.6])
  })

  it('新弹幕默认读取设置 store 中最新的速度', () => {
    useDanmakuSettingsStore.getState().setSpeed(1.7)
    const newBullet = [animation(), animation()]

    setDanmakuAnimationsSpeed([newBullet])

    expect(newBullet.map((item) => item.playbackRate)).toEqual([1.7, 1.7])
  })
})
