import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { synthesizeSpeech } from '../src/lib/tts'

type Segment = { speaker: string; text: string }
type Group = { id: string; type: string; title: string; segments: Segment[]; questions: { number: number; prompt: string }[] }
async function main() {
const paperArg = process.argv.indexOf('--paper-dir')
const paperDir = paperArg < 0 ? 'cet4-original-001' : process.argv[paperArg + 1]
if (!/^cet4-original-\d{3}$/.test(paperDir ?? '')) throw new Error('Invalid original paper folder')
const root = resolve('content/cet-original', paperDir)
const cache = resolve('.local-cet-import', paperDir.replace('cet4-original-', 'original-cet4-'), 'audio')
const voices: Record<string, string> = { narrator: 'en-US-AriaNeural', woman: 'en-US-JennyNeural', man: 'en-US-GuyNeural' }
const listening = JSON.parse(await readFile(join(root, 'listening-script.json'), 'utf8'))
const bodyWordsPerMinute = listening.audioSettings?.bodyWordsPerMinute ?? 130
if (!Number.isFinite(bodyWordsPerMinute) || bodyWordsPerMinute < 120 || bodyWordsPerMinute > 160) throw new Error('Invalid speech pacing')
const listeningSeconds = 25 * 60
const groups: Group[] = listening.groups
const chunks: { file: string; duration: number; text?: string; speaker?: string; group?: string; role: string }[] = []
await mkdir(cache, { recursive: true })
function duration(file: string): number {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())
}
async function speech(text: string, speaker = 'narrator', group?: string, role = 'body') {
  if (text.length > 450) {
    const parts: string[] = []
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      if (sentence.length > 450) throw new Error('Listening sentence exceeds synthesis limit')
      if (parts.length && parts[parts.length - 1].length + sentence.length + 1 <= 450) parts[parts.length - 1] += ' ' + sentence
      else parts.push(sentence)
    }
    for (const part of parts) await speech(part, speaker, group, role)
    return
  }
  const voice = voices[speaker]
  // Reuse the original synthesis; pacing is applied to the WAV separately.
  const key = createHash('sha256').update(JSON.stringify([text, voice, 150, 'v1'])).digest('hex')
  const raw = join(cache, `${key}.mp3`), file = join(cache, `${key}-${bodyWordsPerMinute}-${role}.wav`)
  try { await stat(file) } catch {
    try { await stat(raw) } catch {
      let bytes: Buffer | undefined
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await synthesizeSpeech({ input: text, voice })
          bytes = Buffer.from(await response.arrayBuffer())
          break
        } catch (error) {
          if (attempt === 3) throw error
          console.log(`Retrying speech segment (${attempt}/3)`)
        }
      }
      if (!bytes?.length) throw new Error('Empty speech segment')
      await writeFile(raw, bytes)
    }
    const rawSeconds = duration(raw)
    const words = text.match(/\b[\w]+(?:['’-][\w]+)*\b/g)?.length ?? 0
    const tempo = role === 'body' ? Math.min(2, Math.max(0.5, rawSeconds / (words * 60 / bodyWordsPerMinute))) : 1
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', `atempo=${tempo},loudnorm=I=-18:TP=-2:LRA=7`, '-ar', '24000', '-ac', '1', file])
  }
  chunks.push({ file, duration: duration(file), text, speaker, group, role })
}
await speech(`This is EZTor original practice paper ${Number(paperDir.slice(-3))} for College English Test Band Four. The situations in this paper are fictional. The voices are synthetic. Listening comprehension. Each recording will be played once. Listen carefully and choose the best answer to each question.`, 'narrator', undefined, 'directions')
for (const [i, group] of groups.entries()) {
  if ([0, 3, 5].includes(i)) {
    const section = i === 0 ? 'A' : i === 3 ? 'B' : 'C'
    const material = i === 0 ? 'three news reports' : i === 3 ? 'two long conversations' : 'three passages'
    await speech(`Section ${section}. In this section, you will hear ${material}. After each recording, you will hear some questions. Choose the best answer from the four choices in your paper. You now have time to look at the choices.`, 'narrator', group.id, 'directions')
    chunks.push({ file: '', duration: 20, group: group.id, role: 'preview' })
  }
  const ns = group.questions.map(q => q.number)
  await speech(`Questions ${ns[0]} to ${ns.at(-1)} are based on the ${group.type === 'NEWS' ? 'news report' : group.type === 'CONVERSATION' ? 'conversation' : 'passage'} you are going to hear.`, 'narrator', group.id, 'directions')
  for (const segment of group.segments) await speech(segment.text, segment.speaker, group.id)
  chunks.push({ file: '', duration: 2, group: group.id, role: 'transition' })
  for (const question of group.questions) {
    await speech(`Question ${question.number}. ${question.prompt}`, 'narrator', group.id, 'question')
    chunks.push({ file: '', duration: 0, group: group.id, role: 'answer-time' })
  }
  console.log(`Synthesized ${group.id}: ${group.title}`)
}
await speech('This is the end of listening comprehension. Please check your answers during the remaining time.', 'narrator', undefined, 'directions')
const spoken = chunks.reduce((sum, chunk) => sum + chunk.duration, 0)
const answerPause = 15
const finalCheck = listeningSeconds - spoken - answerPause * 25
if (finalCheck < 0 || finalCheck > 120) throw new Error(`Timing needs revision: final check ${finalCheck.toFixed(2)}s`)
for (const chunk of chunks) if (chunk.role === 'answer-time') chunk.duration = answerPause
chunks.push({ file: '', duration: finalCheck, role: 'final-check' })
let cursor = 0
for (const chunk of chunks) {
  if (!chunk.file) {
    chunk.file = join(cache, `silence-${chunk.duration.toFixed(6)}.wav`)
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(chunk.duration), chunk.file])
  }
}
const list = join(cache, 'concat.txt')
await writeFile(list, chunks.map(chunk => `file '${chunk.file.replace(/'/g, "'\\''")}'`).join('\n'))
const combined = join(cache, 'listening.mp3')
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-b:a', '96k', combined])
const bytes = await readFile(combined), hash = createHash('sha256').update(bytes).digest('hex')
const relative = `study/resources/${hash.slice(0, 24)}.mp3`
await mkdir(resolve('public/study/resources'), { recursive: true })
await writeFile(resolve('public', relative), bytes)
const timeline = chunks.map(({ file: _file, ...chunk }) => {
  const start = cursor
  cursor += chunk.duration
  return { start: Number(start.toFixed(3)), end: Number(cursor.toFixed(3)), ...chunk }
})
await writeFile(join(root, 'audio-manifest.json'), JSON.stringify({
  url: `/${relative}`, sha256: hash, bytes: bytes.length, durationSeconds: listeningSeconds,
  encodedDurationSeconds: duration(combined),
  voices, nominalBodyWordsPerMinute: bodyWordsPerMinute, answerPauseSeconds: answerPause,
  notice: 'AI合成配音；预留答题停顿。字速为制作目标，不代表与真题听感等同。', timeline,
}, null, 2) + '\n')
console.log(`Audio generated: ${relative}; ${duration(combined)}s; ${bytes.length} bytes`)
process.exit(0)

}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Audio generation failed'); process.exit(1) })
