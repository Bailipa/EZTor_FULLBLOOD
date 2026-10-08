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
      <DialogDescription>{data ? `保留 ${MINIMUM_CET_YEAR} 年及以后的 ${data.totalSets} 套材料，可查看本地原卷、解析及配套听力。各卷按实际提供的内容开放在线作答。` : '正在读取材料目录…'}</DialogDescription>
      <div className={styles.catalogueToolbar}>
        <input aria-label="搜索试卷" placeholder="搜索年份、月份或卷别" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
        <select aria-label="筛选试卷级别" value={level} onChange={(event) => setLevel(event.target.value)}><option value="ALL">全部试卷</option><option value="CET4">四级</option><option value="CET6">六级</option></select>
      </div>
      {error && <p role="alert">{error}<button onClick={() => setRetry((old) => old + 1)}>重试</button></p>}
      <div className={styles.catalogueList}>
        {visibleItems?.map((item) => {
          const paper = item.resources?.find((resource) => resource.category === 'paper' && resource.name.includes('可复制')) ?? item.resources?.find((resource) => resource.category === 'paper') ?? item.resources?.find((resource) => resource.category === 'word')
          const answers = item.resources?.filter((resource) => resource.category === 'answer') ?? []
          const answer = answers.find((resource) => resource.name.toLowerCase().endsWith('.pdf')) ?? answers[0]
          const audio = item.resources?.filter((resource) => resource.category === 'audio') ?? []
          return <article key={item.key}>
          <h3>{item.level === 'CET4' ? '四级' : '六级'} · {item.title}</h3>
          {(item.full || item.listening || item.readingPassages > 0) && <p>在线练习：{item.readingPassages ? `${item.readingPassages} 篇逐句阅读 · ` : ''}{item.full ? '整卷及分项练习（按原卷可用内容）' : item.listening ? '听力' : ''}</p>}
          {paper && <div className={styles.resourceActions}><a href={paper.url} target="_blank" rel="noopener noreferrer">{paper.category === 'paper' ? '查看原卷' : '下载原卷 Word'}</a>{answer && <a href={answer.url} target="_blank" rel="noopener noreferrer">{answer.name.toLowerCase().endsWith('.pdf') ? '查看答案解析' : '下载答案解析'}</a>}</div>}
          {!!item.resources?.length && <>
            <p>{answers.length ? `${answers.length} 份答案解析` : '资料未提供对应答案解析'} · {audio.some((resource) => resource.name.toLowerCase().endsWith('.mp3')) ? '有配套听力文件' : '资料未提供对应听力音频'}</p>
            <details><summary>全部原卷与配套资源 · {item.resources.length} 个文件</summary>{item.resources.map((resource) => <p key={`${resource.id}:${resource.name}`}><a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.name}</a></p>)}</details>
          </>}
          <details><summary>资源来源</summary>{item.sources.map((source, index) => <p key={index}>{source.name}</p>)}</details>
        </article>})}
        {data && !visibleItems?.length && <p>未找到符合条件的试卷。</p>}
      </div>
    </DialogContent></Dialog>
  </>
}
