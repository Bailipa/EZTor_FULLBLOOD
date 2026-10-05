'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowRight, Smartphone } from 'lucide-react'
import './share-page.css'

interface ShareProfileData {
  nickname: string
  combatPower: number
  zoneRank: number
  streak: number
  totalWords: number
}

export default function SharePage() {
  const params = useParams()
  const userId = params.userId as string
  const [profile, setProfile] = useState<ShareProfileData | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadedUserId(null)
    setError(null)
    setProfile(null)
    fetch(`/api/share-profile/${userId}`, { signal: controller.signal })
      .then((res) => res.json().then((data) => ({ response: res, data })))
      .then(({ response, data }) => {
        if (controller.signal.aborted) return
        if (response.ok && data.success && data.data) setProfile(data.data)
        else setError(data.error || '用户不存在')
      })
      .catch(() => { if (!controller.signal.aborted) setError('加载失败，请检查网络后重试') })
      .finally(() => {
        if (!controller.signal.aborted) { setLoading(false); setLoadedUserId(userId) }
      })
    return () => controller.abort()
  }, [userId, retry])

  return (
    <main className="learning-share-page">
      {loading || loadedUserId !== userId ? <div className="learning-share-status" role="status"><Loader2 className="size-6 animate-spin mx-auto" /><p>正在读取学习成果…</p></div> : error || !profile ? <div className="learning-share-status"><h1>暂时无法查看学习成果</h1><p role="alert">{error || '用户不存在'}</p><button onClick={() => setRetry((value) => value + 1)}>重新加载</button><Link href="/">进入首页</Link></div> : <div className="learning-share-layout">
        <section className="learning-share-card" aria-label={`${profile.nickname} 的学习成果`}>
          <div className="learning-share-brand"><span>EZTor</span><span>学习成果</span></div>
          <h2 className="learning-share-name">{profile.nickname}</h2>
          <p className="learning-share-note">每次学习，积累一点。</p>
          <div className="learning-share-power"><strong>{profile.combatPower.toLocaleString()}</strong><span>总学力</span></div>
          <dl className="learning-share-stats">
            <div><dt>连续学习</dt><dd>{profile.streak}<small> 天</small></dd></div>
            <div><dt>已入库单词</dt><dd>{profile.totalWords.toLocaleString()}<small> 词</small></dd></div>
            <div><dt>本月学区排名</dt><dd>{profile.zoneRank > 0 ? `第 ${profile.zoneRank} 名` : '暂无排名'}</dd></div>
          </dl>
          <p className="learning-share-signoff">EZTor · An Easier Translator</p>
        </section>
        <section className="learning-share-context">
          <h1>从一个单词开始，<br />积累自己的学习成果。</h1>
          <p>这是好友在 EZTor 的学习记录。你也可以查词、整理词库，继续每日复习。</p>
          <Link className="learning-share-primary" href="/">开始学习<ArrowRight className="size-4" /></Link>
          <Link href="/download"><Smartphone className="size-4" />下载 EZTor</Link>
        </section>
      </div>}
    </main>
  )
}
