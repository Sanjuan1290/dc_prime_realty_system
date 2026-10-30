import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('Attendance kiosk is hosted by HR and disabled until approved', () => {
  const system = read('CLIENT/SYSTEM/src/App.jsx')
  const hr = read('CLIENT/HR/src/App.jsx')
  const flags = read('CLIENT/HR/src/config/featureFlags.js')
  assert.doesNotMatch(system, /AttendanceKiosk/)
  assert.match(hr, /const Kiosk=lazy\(\(\)=>import\('\.\/pages\/Public\/AttendanceKiosk'\)\)/)
  assert.match(hr, /path:'\/kiosk'/)
  assert.match(hr, /HR_FEATURE_FLAGS\.kiosk/)
  assert.match(flags, /kiosk: import\.meta\.env\.DEV/)
})

test('safe storage never requires direct access to localStorage or sessionStorage to succeed', () => {
  const storage = read('CLIENT/SYSTEM/src/utils/safeStorage.js')
  assert.match(storage, /try[\s\S]*window\.localStorage/)
  assert.match(storage, /try[\s\S]*window\.sessionStorage/)
  assert.match(storage, /getItem\(key\)[\s\S]*catch/)
  assert.match(storage, /setItem\(key, value\)[\s\S]*catch/)
  assert.match(storage, /removeItem\(key\)[\s\S]*catch/)
})

test('public website preference writes use safe storage instead of direct localStorage access', () => {
  const preferences = read('CLIENT/WEBSITE/src/website/context/ProjectPreferencesContext.jsx')
  assert.match(preferences, /safeLocalStorage\.getItem/)
  assert.match(preferences, /safeLocalStorage\.setItem/)
  assert.doesNotMatch(preferences, /window\.localStorage/)
})




