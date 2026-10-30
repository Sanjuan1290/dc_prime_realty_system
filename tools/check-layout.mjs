import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const dirs = ['CLIENT/WEBSITE','CLIENT/SYSTEM','CLIENT/HR','CLIENT/FINANCE','SERVER/WEBSITE','SERVER/SYSTEM','SERVER/HR','SERVER/FINANCE']
for (const d of dirs) {
  const p = path.join(root,d)
  if (!fs.existsSync(path.join(p,'package.json'))) throw new Error(`Missing package: ${d}`)
}
for (const d of ['CLIENT/WEBSITE','CLIENT/SYSTEM','CLIENT/HR','CLIENT/FINANCE']) {
  if (!fs.existsSync(path.join(root,d,'index.html'))) throw new Error(`Missing frontend index: ${d}`)
}
for (const d of ['SERVER/WEBSITE','SERVER/SYSTEM','SERVER/HR']) {
  if (!fs.existsSync(path.join(root,d,'server.js'))) throw new Error(`Missing server entry: ${d}`)
}
if (!fs.existsSync(path.join(root,'SERVER/FINANCE/src/server.js'))) throw new Error('Missing Finance server entry')
console.log('All 8 application package paths are present.')
