import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('public Attendance boots independently from the portal and website app graph', () => {
  const main = read('client/src/main.jsx')
  assert.match(main, /const App = lazy\(\(\) => import\('\.\/App\.jsx'\)\)/)
  assert.match(main, /const AttendanceKiosk = lazy\(\(\) => import\('\.\/pages\/Public\/AttendanceKiosk\.jsx'\)\)/)
  assert.match(main, /normalizedPathname === '\/attendance'/)
  assert.match(main, /isStandaloneAttendance[\s\S]*<AttendanceKiosk \/>/)
  assert.doesNotMatch(main, /import App from '\.\/App\.jsx'/)
})

test('safe storage never requires direct access to localStorage or sessionStorage to succeed', () => {
  const storage = read('client/src/utils/safeStorage.js')
  assert.match(storage, /try[\s\S]*window\.localStorage/)
  assert.match(storage, /try[\s\S]*window\.sessionStorage/)
  assert.match(storage, /getItem\(key\)[\s\S]*catch/)
  assert.match(storage, /setItem\(key, value\)[\s\S]*catch/)
  assert.match(storage, /removeItem\(key\)[\s\S]*catch/)
})

test('public website preference writes use safe storage instead of direct localStorage access', () => {
  const preferences = read('client/src/website/context/ProjectPreferencesContext.jsx')
  assert.match(preferences, /safeLocalStorage\.getItem/)
  assert.match(preferences, /safeLocalStorage\.setItem/)
  assert.doesNotMatch(preferences, /window\.localStorage/)
})
