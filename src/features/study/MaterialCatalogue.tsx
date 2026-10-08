'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { studyRequest } from './client'
import type { StudyMaterialCatalogue } from './materialTypes'
import { MINIMUM_CET_YEAR } from './paperAvailability'
import styles from './study-workspace.module.css'

export default function MaterialCatalogue({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const [data, setData] = useState<StudyMaterialCatalogue | null>(null)
  const [error, setError] = useState('')
  const [level, setLevel] = useState('ALL')
  const [query, setQuery] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    void studyRequest<StudyMaterialCatalogue>(accountId, '/api/study/materials', { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result) })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '目录暂不可用') })
    return () => controller.abort()
  }, [accountId, retry])
  const search = query.trim().replace(/\s+/g, '').toLowerCase()
  const visibleItems = data?.items.filter((item) => (level === 'ALL' || item.level === level) &&
    (!search || item.title.replace(/\s+/g, '').toLowerCase().includes(search) || item.key.includes(search.replaceAll('.', '-'))))
  return <>
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className={styles.catalogueDialog}>
      <DialogTitle>试卷目录</DialogTitle>
      <DialogDescription>{data ? `保留 ${MINIMUM_CET_YEAR} 年及以后的 ${data.totalSets} 套材料。各卷按实际提供的内容开放在线作答，并提供配套听力。` : '正在读取材料目录…'}</DialogDescription>
      <div className={styles.catalogueToolbar}>
        <input aria-label="搜索试卷" placeholder="搜索年份、月份或卷别" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
        <select aria-label="筛选试卷级别" value={level} onChange={(event) => setLevel(event.target.value)}><option value="ALL">全部试卷</option><option value="CET4">四级</option><option value="CET6">六级</option></select>
      </div>
      {error && <p role="alert">{error}<button onClick={() => setRetry((old) => old + 1)}>重试</button></p>}
      <div className={styles.catalogueList}>
        {visibleItems?.map((item) => {
          const audio = item.resources?.filter((resource) => resource.category === 'audio') ?? []
          return <article key={item.key}>
          <h3>{item.level === 'CET4' ? '四级' : '六级'} · {item.title}</h3>
          {(item.full || item.listening || item.readingPassages > 0) && <p>在线练习：{item.readingPassages ? `${item.readingPassages} 篇逐句阅读 · ` : ''}{item.full ? '整卷及分项练习（按可用内容）' : item.listening ? '听力' : ''}</p>}
          {!!item.resources?.length && <>
            <p>{audio.length ? '有配套听力文件' : '资料未提供对应听力音频'}</p>
            {!!audio.length && <details><summary>配套听力 · {audio.length} 个文件</summary>{audio.map((resource) => <p key={`${resource.id}:${resource.name}`}><a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.name}</a></p>)}</details>}
          </>}
        </article>})}
        {data && !visibleItems?.length && <p>未找到符合条件的试卷。</p>}
      </div>
    </DialogContent></Dialog>
  </>
}
