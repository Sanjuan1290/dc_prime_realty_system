import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const client = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dist = join(client, 'dist')
const apps = [
  { name: 'WEBSITE', output: '', api: {} },
  { name: 'SYSTEM', output: 'system', api: { VITE_API_URL: '/api/v1' } },
  { name: 'FINANCE', output: 'finance', api: { VITE_FINANCE_API_URL: '/finance-api' } },
  { name: 'HR', output: 'hr', api: { VITE_HR_API_URL: '/hr-api/api/v1', VITE_HR_STAGING_WRITES: 'false', VITE_HR_KIOSK_ENABLED: 'false' } },
]
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
for (const { name, output, api } of apps) {
  const cwd = join(client, name)
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const install = existsSync(join(cwd, 'package-lock.json')) ? ['ci'] : ['install']
  function run(args) {
    console.log(`\n> ${name}: npm ${args.join(' ')}`)
    const result = spawnSync(npm, args, {
      cwd, stdio: 'inherit', env: { ...process.env, DC_MULTI_APP_BUILD: '1', ...api },
    })
    if (result.status !== 0) process.exit(result.status || 1)
  }
  run([...install, '--no-audit', '--no-fund'])
  run(['run', 'build'])
  const from = join(cwd, 'dist')
  if (!existsSync(join(from, 'index.html'))) throw new Error(`${name} build missing index.html`)
  const to = output ? join(dist, output) : dist
  mkdirSync(to, { recursive: true })
  cpSync(from, to, { recursive: true, force: true })
  // Each Vite app previously declared an independent SPA rewrite; those
  // must not override the combined project routing.
  rmSync(join(to, '_redirects'), { force: true })
  console.log(`Copied ${name} to ${to}`)
}
// Avoid root-level 404.html: Pages' default SPA behavior serves the website
// on its own client-side routes. Subapps use their own Pages Functions.
console.log('Combined Pages output ready:', dist)
