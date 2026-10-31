import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const client = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dist = join(client, 'dist')
const apps = [
  { name: 'WEBSITE', output: '', api: {} },
  { name: 'SYSTEM', output: 'system', api: { VITE_API_URL: '/api/v1' } },
  { name: 'FINANCE', output: 'finance', api: { VITE_FINANCE_API_URL: '/finance-api' } },
  { name: 'HR', output: 'hr', api: { VITE_HR_API_URL: '/hr-api/api/v1', VITE_HR_STAGING_WRITES: process.env.VITE_HR_STAGING_WRITES === 'true' ? 'true' : 'false', VITE_HR_KIOSK_ENABLED: 'false' } },
]
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
for (const { name, output, api } of apps) {
  const cwd = join(client, name)
  // npm.cmd cannot be executed directly by spawnSync on Windows. Reuse the
  // npm CLI that launched this script so paths with spaces remain literal.
  const npmCli = process.env.npm_execpath
  if (!npmCli || !existsSync(npmCli)) throw new Error('Run this script with npm run build:all.')
  const lockfile = join(cwd, 'package-lock.json')
  const hasLockfile = existsSync(lockfile)
  if (hasLockfile) {
    const lock = JSON.parse(readFileSync(lockfile, 'utf8'))
    if (Number(lock.lockfileVersion) < 1 || !lock.packages) {
      throw new Error(`${name}: invalid package-lock.json: ${lockfile}`)
    }
  }
  const install = hasLockfile ? ['ci'] : ['install']
  function run(args) {
    // Always specify the child app explicitly: Cloudflare runs this script
    // through npm at CLIENT/, which can leave parent npm settings in the environment.
    console.log(`\n> ${name}: npm --prefix ${cwd} ${args.join(' ')}`)
    const childEnv = { ...process.env, DC_MULTI_APP_BUILD: '1', ...api }
    delete childEnv.npm_config_local_prefix
    delete childEnv.NPM_CONFIG_LOCAL_PREFIX
    const result = spawnSync(process.execPath, [npmCli, '--prefix', cwd, ...args], {
      cwd: client, stdio: 'inherit', env: childEnv,
    })
    if (result.error) throw result.error
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

