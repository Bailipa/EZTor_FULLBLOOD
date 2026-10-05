#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = process.env.DEPLOY_PACKAGE_DIR || path.join(tmpdir(), 'eztor-release-packages')
const standaloneDir = path.join(projectRoot, '.next/standalone')
const stageParent = await mkdtemp(path.join(tmpdir(), 'eztor-package-stage-'))
const stageDir = path.join(stageParent, 'payload')
const tarPath = path.join(stageParent, 'package.tar.gz')

function requiredPath(filePath, label) {
  return stat(filePath).catch(() => { throw new Error(`Missing ${label}: ${path.relative(projectRoot, filePath)}`) })
}

function excludedName(name) {
  return name.startsWith('._') || name === '.DS_Store' || name === '.git' || name === '.cache' ||
    ['.npmrc', '.netrc', '.ssh', '.aws', '.gnupg'].includes(name) || name.startsWith('.env') ||
    /\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$/i.test(name) ||
    /\.(?:log|pem|key|p12|pfx|jks|dump|backup)$/i.test(name)
}

async function copyRuntimeTree(source, destination, sourceRoot, excludedRootDirs = []) {
  const entries = await readdir(source, { withFileTypes: true })
  await mkdir(destination, { recursive: true })
  for (const entry of entries) {
    if (excludedName(entry.name) || excludedRootDirs.includes(entry.name)) continue
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isSymbolicLink()) {
      const resolved = await realpath(from)
      if (resolved !== sourceRoot && !resolved.startsWith(`${sourceRoot}${path.sep}`)) {
        throw new Error(`Refusing out-of-tree symlink: ${path.relative(projectRoot, from)}`)
      }
      await symlink(path.relative(path.dirname(from), resolved), to)
    } else if (entry.isDirectory()) {
      await copyRuntimeTree(from, to, sourceRoot)
    } else if (entry.isFile()) {
      await copyFile(from, to)
    }
  }
}

async function copyMigrations(source, destination) {
  await mkdir(destination, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === 'migration_lock.toml') {
      await copyFile(path.join(source, entry.name), path.join(destination, entry.name))
      continue
    }
    if (!entry.isDirectory() || !/^[A-Za-z0-9_-]+$/.test(entry.name)) continue
    const migrationSource = path.join(source, entry.name)
    const migrationTarget = path.join(destination, entry.name)
    await mkdir(migrationTarget, { recursive: true })
    for (const file of await readdir(migrationSource, { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.sql') && !excludedName(file.name)) {
        await copyFile(path.join(migrationSource, file.name), path.join(migrationTarget, file.name))
      }
    }
  }
}

async function inventory(dir, prefix = '') {
  const members = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name)
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) members.push(...await inventory(fullPath, relative))
    else members.push(relative)
  }
  return members
}

async function sha256(filePath) {
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', resolve)
  })
  return hash.digest('hex')
}

try {
  const standaloneRoot = await realpath(standaloneDir)
  const projectBuildIdPath = path.join(projectRoot, '.next/BUILD_ID')
  const standaloneBuildIdPath = path.join(standaloneDir, '.next/BUILD_ID')
  const required = [
    ['server.js', 'standalone server'],
    ['package.json', 'standalone package manifest'],
    ['node_modules', 'standalone runtime dependencies'],
    ['.next', 'standalone Next runtime'],
  ]
  await Promise.all(required.map(([relative, label]) => requiredPath(path.join(standaloneDir, relative), label)))
  await requiredPath(path.join(projectRoot, '.next/static'), 'Next static assets')
  await requiredPath(path.join(projectRoot, 'public'), 'public assets')
  await requiredPath(path.join(projectRoot, 'node_modules/ipa-dict'), 'runtime ipa-dict package')
  await requiredPath(path.join(projectRoot, 'prisma/schema.prisma'), 'Prisma schema')
  await requiredPath(path.join(projectRoot, 'prisma/migrations'), 'Prisma migrations')

  const buildId = (await readFile(projectBuildIdPath, 'utf8')).trim()
  const standaloneBuildId = (await readFile(standaloneBuildIdPath, 'utf8')).trim()
  if (!buildId || buildId !== standaloneBuildId) throw new Error('Root and standalone Next BUILD_ID do not match')
  const packageInfo = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))

  await mkdir(stageDir, { recursive: true })
  for (const file of ['server.js', 'package.json']) {
    await copyFile(path.join(standaloneDir, file), path.join(stageDir, file))
  }
  await copyRuntimeTree(path.join(standaloneDir, '.next'), path.join(stageDir, '.next'), standaloneRoot, ['cache'])
  await copyRuntimeTree(path.join(standaloneDir, 'node_modules'), path.join(stageDir, 'node_modules'), standaloneRoot)
  await rm(path.join(stageDir, '.next/static'), { recursive: true, force: true })
  await copyRuntimeTree(path.join(projectRoot, '.next/static'), path.join(stageDir, '.next/static'), await realpath(path.join(projectRoot, '.next/static')))
  await copyRuntimeTree(path.join(projectRoot, 'public'), path.join(stageDir, 'public'), await realpath(path.join(projectRoot, 'public')), ['downloads', 'updates'])
  await rm(path.join(stageDir, 'node_modules/ipa-dict'), { recursive: true, force: true })
  // Only the English dictionary is used at runtime; keep its package metadata.
  for (const file of ['package.json', 'LICENSE', 'lib/en_US.js']) {
    const destination = path.join(stageDir, 'node_modules/ipa-dict', file)
    await mkdir(path.dirname(destination), { recursive: true })
    await copyFile(path.join(projectRoot, 'node_modules/ipa-dict', file), destination)
  }
  await mkdir(path.join(stageDir, 'prisma'), { recursive: true })
  await copyFile(path.join(projectRoot, 'prisma/schema.prisma'), path.join(stageDir, 'prisma/schema.prisma'))
  await copyMigrations(path.join(projectRoot, 'prisma/migrations'), path.join(stageDir, 'prisma/migrations'))

  const now = new Date()
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 17)
  const safeBuildId = buildId.replace(/[^A-Za-z0-9_-]/g, '_')
  const filename = `eztor-web-${packageInfo.version}-${safeBuildId}-${stamp}.tar.gz`
  await mkdir(outputDir, { recursive: true })
  const archivePath = path.join(outputDir, filename)
  const manifestPath = `${archivePath}.manifest.json`
  const checksumPath = `${archivePath}.sha256`
  for (const output of [archivePath, manifestPath, checksumPath]) {
    try { await stat(output); throw new Error(`Refusing to overwrite existing output: ${output}`) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }

  const members = (await inventory(stageDir)).sort()
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  let sourceDirty = true
  try {
    sourceDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: projectRoot, encoding: 'utf8' }).trim().length > 0
  } catch {}

  execFileSync('tar', ['-czf', tarPath, '-C', stageDir, '.'], {
    stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' },
  })
  const archiveHash = await sha256(tarPath)
  const archiveStats = await stat(tarPath)
  const manifest = {
    package: filename,
    version: packageInfo.version,
    nextBuildId: buildId,
    nextPublicBuildId: process.env.NEXT_PUBLIC_BUILD_ID || null,
    sourceCommit,
    sourceDirty,
    createdAt: now.toISOString(),
    archiveBytes: archiveStats.size,
    sha256: archiveHash,
    members,
  }

  await copyFile(tarPath, archivePath, fsConstants.COPYFILE_EXCL)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  await writeFile(checksumPath, `${archiveHash}  ${filename}\n`, { flag: 'wx' })
  console.log(`Prepared review package: ${archivePath}`)
  console.log(`Manifest: ${manifestPath}`)
  console.log(`SHA-256: ${archiveHash}`)
} finally {
  await rm(stageParent, { recursive: true, force: true })
}
