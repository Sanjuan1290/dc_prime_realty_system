import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Detect missing JavaScript dependency files BEFORE Render tries to start.
// Dependency packages and media assets are intentionally outside this check.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requested = process.argv[2]
const target = requested ? path.resolve(requested) : path.join(root, 'server.js')
const projectDir = requested ? target : root
const scriptExtensions = ['.js', '.jsx', '.mjs', '.cjs', '.json']
const folderSkips = new Set(['node_modules', 'dist', 'build', '.git'])
const issues = []

const files = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  if (entry.isDirectory()) return folderSkips.has(entry.name) ? [] : files(path.join(directory, entry.name))
  if (!entry.isFile() || !/\.(?:m?js|jsx|cjs)$/.test(entry.name)) return []
  return [path.join(directory, entry.name)]
})
const sources = requested ? files(target) : files(root).filter((file) => !file.includes(`${path.sep}tests${path.sep}`))
const importPattern = /\b(?:import|export)\s+(?:(?:[\w*{},\s]+?)\s+from\s+)?['"](\.{1,2}\/[^'"\n]+)['"]/g

for (const file of sources) {
  const code = fs.readFileSync(file, 'utf8')
  for (const match of code.matchAll(importPattern)) {
    const spec = match[1]
    const ext = path.extname(spec)
    if (ext && !scriptExtensions.includes(ext)) continue // CSS and media
    const base = path.resolve(path.dirname(file), spec)
    const candidates = ext ? [base] : [base, ...scriptExtensions.map((suffix) => `${base}${suffix}`), ...scriptExtensions.map((suffix) => path.join(base, `index${suffix}`))]
    if (!candidates.some((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())) {
      issues.push(`${path.relative(projectDir, file)} imports missing ${spec}`)
    }
  }
}
if (issues.length) {
  console.error('Missing local JavaScript module(s):\n' + issues.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Local JavaScript import check passed (${sources.length} source files).`)
}

