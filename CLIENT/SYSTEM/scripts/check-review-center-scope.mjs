import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Build must fail if the Review Details page accesses list-scoped summary counts.
// This deliberately runs before Vite on Cloudflare Pages via npm's prebuild hook.
const here = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(here, '../src/pages/System/ReviewCenter.jsx')
const source = fs.readFileSync(sourcePath, 'utf8')
const detailStart = source.indexOf('export const ReviewDetails =')
const centerStart = source.indexOf('const ReviewCenter = () => {')

const fail = (message) => {
  console.error(`Review Center prebuild check failed: ${message}`)
  process.exit(1)
}

if (detailStart < 0 || centerStart <= detailStart) {
  fail('Could not locate ReviewDetails and ReviewCenter component boundaries.')
}

const details = source.slice(detailStart, centerStart)
const center = source.slice(centerStart)
if (/\bcounts\b/.test(details)) {
  fail('ReviewDetails accesses counts from ReviewCenter. Move the warning to ReviewCenter.')
}
if (!/const counts\s*=\s*summary\.data\?\.data\s*\|\|\s*\{\}/.test(center)) {
  fail('ReviewCenter must own the summary counts.')
}
// Requirements that were accidentally lost in previous source merges. Keep
// these checks in the frontend's prebuild path rather than in opt-in tests only.
const invariants = [
  [!center.includes('Mark All as Read') && !center.includes('Mark as Read') && !center.includes('Unread Notifications'), 'Internal notification controls must remain outside Review Center.'],
  [details.includes('Submit Correction Details for Recheck'), 'Staff manual correction resubmission was removed.'],
  [center.includes("['history','Review History']") && center.includes("['history','Correction History']"), 'Role-specific history tabs are missing.'],
  [center.includes("navigate(root+'/review-center/reviews/'+row.operational_review_id)"), 'Dedicated review navigation is missing.'],
  [center.includes("root='/portal/'+actor.role"), 'Review Center route scope is missing.'],
  [details.includes('PaymentProofReviewFiles'), 'Protected payment-proof review was removed.'],
]
for (const [ok, message] of invariants) {
  if (!ok) fail(message)
}
console.log('Review Center prebuild check passed.')



