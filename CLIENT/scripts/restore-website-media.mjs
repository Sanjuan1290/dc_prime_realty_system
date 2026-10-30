/**
 * Restore *real* WEBSITE media after splitting the monorepo.
 * Runs locally with Node 20+; never downloads media or invents project photography.
 *
 * From repository root:
 *   node CLIENT/scripts/restore-website-media.mjs
 *   node CLIENT/scripts/restore-website-media.mjs --from "D:\\old-project"
 *   node CLIENT/scripts/restore-website-media.mjs --check
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(clientRoot, '..')
const publicRoot = path.join(clientRoot, 'WEBSITE', 'public')
const sourceFile = path.join(clientRoot, 'WEBSITE', 'src', 'website', 'data', 'staticSite.js')
const raw = fs.readFileSync(sourceFile, 'utf8')
const referenced = [...raw.matchAll(/\/website\/images\/[A-Za-z0-9._/-]+/g)].map((x) => x[0])
const fallback = [
  '/website/images/redesign/scenic-hero-placeholder.webp',
  '/website/images/redesign/scenic-guide-placeholder.webp',
]
const expected = [...new Set([...referenced, ...fallback])].sort()
const checkOnly = process.argv.includes('--check')
const fromIndex = process.argv.indexOf('--from')
if (fromIndex !== -1 && !process.argv[fromIndex + 1]) {
  console.error('Usage: --from "PATH_TO_ORIGINAL_MEDIA_OR_OLD_REPOSITORY"')
  process.exit(2)
}
const suppliedRoot = fromIndex === -1 ? null : path.resolve(process.argv[fromIndex + 1])
if (suppliedRoot && !fs.existsSync(suppliedRoot)) {
  console.error(`Original media path not found: ${suppliedRoot}`)
  process.exit(2)
}

function valid(file, url) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false
  const size = fs.statSync(file).size
  const isPlaceholder = url.includes('/redesign/scenic-')
  if (!isPlaceholder && size <= 10_000) return false
  if (isPlaceholder && size >= 300_000) return false
  if (url.endsWith('prime-enclave-hero-loop.mp4') && (size <= 100_000 || size >= 3_000_000)) return false
  const fd = fs.openSync(file, 'r')
  const header = Buffer.alloc(16)
  try { fs.readSync(fd, header, 0, 16, 0) } finally { fs.closeSync(fd) }
  if (url.endsWith('.webp')) return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
  if (url.endsWith('.png')) return header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  if (url.endsWith('.mp4')) return header.toString('ascii', 4, 8) === 'ftyp'
  return false
}

function runGit(args, encoding = 'utf8') {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding, maxBuffer: 160 * 1024 * 1024 })
  if (result.error || result.status !== 0) return null
  return result.stdout
}
const candidates = new Map()
if (!checkOnly) {
  const history = runGit(['rev-list', '--objects', '--all'])
  if (history) {
    for (const line of history.split(/\r?\n/)) {
      const sep = line.indexOf(' ')
      if (sep < 0) continue
      const hash = line.slice(0, sep)
      const gitPath = line.slice(sep + 1).replace(/\\/g, '/')
      const match = gitPath.match(/(?:^|\/)(website\/images\/.*)$/i)
      if (!match) continue
      const url = '/' + match[1]
      if (!expected.includes(url)) continue
      if (!candidates.has(url)) candidates.set(url, [])
      candidates.get(url).push({ hash, gitPath })
    }
  }
}

const sourceRoots = [
  path.join(repoRoot, 'CLIENT', 'SYSTEM', 'public'),
  path.join(repoRoot, 'client', 'public'),
  path.join(repoRoot, 'CLIENT', 'public'),
  path.join(repoRoot, 'public'),
]
if (suppliedRoot) {
  sourceRoots.unshift(
    suppliedRoot,
    path.join(suppliedRoot, 'CLIENT', 'WEBSITE', 'public'),
    path.join(suppliedRoot, 'CLIENT', 'SYSTEM', 'public'),
    path.join(suppliedRoot, 'client', 'public'),
    path.join(suppliedRoot, 'public'),
  )
}

// For original asset folders not laid out as a repository, find exact filenames.
const filenames = new Map()
function scanTree(dir, depth = 0) {
  if (!fs.existsSync(dir) || depth > 12) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (['.git', 'node_modules', 'dist', '.next'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) scanTree(full, depth + 1)
    else if (entry.isFile()) {
      const key = entry.name.toLowerCase()
      if (!filenames.has(key)) filenames.set(key, [])
      filenames.get(key).push(full)
    }
  }
}
if (suppliedRoot && !checkOnly) scanTree(suppliedRoot)

function chooseLocal(url) {
  const rel = url.replace(/^\//, '')
  for (const dir of sourceRoots) {
    const file = path.join(dir, rel)
    if (valid(file, url)) return file
  }
  if (suppliedRoot) {
    const matching = (filenames.get(path.basename(rel).toLowerCase()) || []).filter((file) => valid(file, url))
    if (matching.length === 1) return matching[0]
    if (matching.length > 1) {
      const suffix = rel.toLowerCase().replace(/\//g, path.sep)
      const exact = matching.filter((file) => file.toLowerCase().endsWith(suffix))
      if (exact.length === 1) return exact[0]
    }
  }
  return null
}

function restoreFromHistory(url, destination) {
  const matches = (candidates.get(url) || []).sort((a, b) => {
    const score = (x) => Number(/CLIENT\/WEBSITE/i.test(x.gitPath)) * 10 + Number(/CLIENT\/SYSTEM/i.test(x.gitPath)) * 5
    return score(b) - score(a)
  })
  for (const { hash, gitPath } of matches) {
    const blob = runGit(['cat-file', 'blob', hash], null)
    if (!Buffer.isBuffer(blob) || blob.length === 0) continue
    // Git LFS pointers are not actual image/video data.
    if (blob.subarray(0, 70).toString('utf8').includes('git-lfs.github.com/spec')) continue
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, blob)
    if (valid(destination, url)) {
      console.log(`RESTORED from Git: ${url} (${gitPath})`)
      return true
    }
    fs.rmSync(destination)
  }
  return false
}

function makeHeroLoop() {
  const url = '/website/images/drive/maragondon/prime-enclave-hero-loop.mp4'
  const dest = path.join(publicRoot, url.slice(1))
  if (valid(dest, url)) return true
  const original = path.join(publicRoot, 'website/images/drive/maragondon/prime-enclave-tour.mp4')
  if (!valid(original, '/website/images/drive/maragondon/prime-enclave-tour.mp4')) return false
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  if (probe.error || probe.status !== 0) {
    console.warn('Cannot create the short silent hero clip: ffmpeg is not installed. Restore the original hero-loop.mp4 or install ffmpeg.')
    return false
  }
  for (const [width, crf] of [[960, 31], [720, 34], [640, 38]]) {
    const temp = path.join(path.dirname(dest), `.hero-loop-${process.pid}.mp4`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', original,
      '-t', '13', '-an', '-vf', `scale=w='min(${width},iw)':h=-2:flags=lanczos`,
      '-r', '24', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', temp,
    ]
    const result = spawnSync('ffmpeg', args, { encoding: 'utf8' })
    if (result.status === 0 && valid(temp, url)) {
      fs.renameSync(temp, dest)
      console.log(`GENERATED 13-second silent loop from original Maragondon tour: ${url}`)
      return true
    }
    if (fs.existsSync(temp)) fs.rmSync(temp)
  }
  console.warn('The original tour was found, but ffmpeg could not create a valid under-3MB silent loop.')
  return false
}

let restored = 0
const missing = []
for (const url of expected) {
  const dest = path.join(publicRoot, url.slice(1))
  if (valid(dest, url)) continue
  if (!checkOnly) {
    const source = chooseLocal(url)
    if (source) {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(source, dest)
      console.log(`RESTORED from disk: ${url}`)
      restored++
      continue
    }
    if (restoreFromHistory(url, dest)) { restored++; continue }
    if (url.endsWith('/prime-enclave-hero-loop.mp4') && makeHeroLoop()) { restored++; continue }
  }
  missing.push(url)
}
// Hero clip may have been visited before the source tour was restored. Retry once.
const heroURL = '/website/images/drive/maragondon/prime-enclave-hero-loop.mp4'
if (!checkOnly && missing.includes(heroURL) && makeHeroLoop()) {
  missing.splice(missing.indexOf(heroURL), 1)
  restored++
}
console.log(`\nWEBSITE media: ${expected.length - missing.length}/${expected.length} valid; ${restored} restored this run.`)
if (missing.length) {
  console.error(`\nMISSING or INVALID (${missing.length}):`)
  for (const url of missing) console.error(`  CLIENT/WEBSITE/public${url}`)
  if (!checkOnly) {
    console.error('\nRestore the ORIGINAL media via Git history or rerun with --from "PATH_TO_OLD_MEDIA".')
    console.error('Do not use fake photo/video files to make the tests pass.')
  }
  process.exitCode = 1
}
