import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hash = createHash('sha256').update(repo).digest('hex').slice(0, 12)
const preview = path.join(repo, '.local-preview', hash)
const marker = path.join(preview, '.preview-owner')
const command = process.argv[2]
if (command !== 'build' && command !== 'start') throw new Error('Use preview:build or preview:start.')

const require = createRequire(import.meta.url)
require('@next/env').loadEnvConfig(repo, true, { info() {}, error() {} })
let database
try { database = new URL(process.env.DATABASE_URL) } catch { throw new Error('Preview requires a local PostgreSQL DATABASE_URL.') }
if (!['postgres:', 'postgresql:'].includes(database.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
  throw new Error('Preview refuses a non-loopback PostgreSQL DATABASE_URL.')
}

if (command === 'build') {
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', error => {
      if (error.code === 'EADDRINUSE') reject(new Error('Port 3001 is occupied. Stop the local preview before rebuilding it.'))
      else reject(error)
    })
    server.listen(3001, '127.0.0.1', () => server.close(error => error ? reject(error) : resolve()))
  })
  const existing = await lstat(preview).catch(error => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (existing) {
    if (existing.isSymbolicLink() || await readFile(marker, 'utf8') !== repo) throw new Error('Preview directory is not owned by this script.')
    await rm(preview, { recursive: true })
  }
  await mkdir(preview, { recursive: true })
  await writeFile(marker, repo)
  const copyTree = (name, omitted) => cp(path.join(repo, name), path.join(preview, name), {
    recursive: true,
    filter: (source) => {
      const parts = path.relative(path.join(repo, name), source).split(path.sep)
      return !parts.some(part => omitted.includes(part) || part === '.DS_Store' || part.startsWith('._') || part.startsWith('.env'))
    },
  })
  await copyTree('src', ['__tests__', '_deprecated'])
  await copyTree('public', ['downloads', 'updates'])
  await mkdir(path.join(preview, 'prisma'))
  await cp(path.join(repo, 'prisma/schema.prisma'), path.join(preview, 'prisma/schema.prisma'))
  for (const name of ['package.json', 'postcss.config.mjs', 'components.json']) {
    await cp(path.join(repo, name), path.join(preview, name))
  }
  const config = await readFile(path.join(repo, 'next.config.ts'), 'utf8')
  if (!config.includes('export default nextConfig')) throw new Error('Unsupported Next config export.')
  await writeFile(path.join(preview, 'next.config.ts'), config.replace('export default nextConfig', `export default {
    ...nextConfig,
    output: undefined,
    distDir: '.next',
    outputFileTracingRoot: ${JSON.stringify(repo)},
    turbopack: { ...nextConfig.turbopack, root: ${JSON.stringify(repo)} },
  }`))
  const tsconfig = JSON.parse(await readFile(path.join(repo, 'tsconfig.json'), 'utf8'))
  tsconfig.include = ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', 'src/**/*.mts', '.next/types/**/*.ts']
  tsconfig.exclude = ['node_modules', 'src/_deprecated', 'src/__tests__']
  tsconfig.compilerOptions.tsBuildInfoFile = '.next/cache/preview.tsbuildinfo'
  await writeFile(path.join(preview, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n')
  await symlink(path.join(repo, 'node_modules'), path.join(preview, 'node_modules'), 'junction')
} else {
  if (await readFile(marker, 'utf8') !== repo) throw new Error('Preview directory is not owned by this script.')
  await stat(path.join(preview, '.next/BUILD_ID'))
}

const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), command, ...(command === 'start' ? ['--hostname', '127.0.0.1', '--port', '3001'] : [])], {
  cwd: preview,
  env: { ...process.env, NODE_ENV: 'production', NEXTAUTH_URL: 'http://127.0.0.1:3001', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3001' },
  stdio: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', () => { console.error('Could not launch the local preview.'); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
