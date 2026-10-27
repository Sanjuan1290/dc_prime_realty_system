import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const read=file=>fs.readFileSync(path.join(root,file),'utf8')
const has=file=>fs.existsSync(path.join(root,file))
const src=file=>read(`client/src/website/${file}`)

test('featured Prime Enclave has location-first landing copy, eager hero and sample disclaimer',()=>{
 const home=src('pages/Home.jsx')
 assert.match(home,/Own land in/)
 assert.match(home,/Maragondon, Cavite/)
 const media=src('components/HeroBackgroundVideo.jsx')
 assert.match(media,/fetchPriority="high"/)
 assert.match(media,/loading="eager"/)
 assert.match(home,/HeroBackgroundVideo/)
 assert.doesNotMatch(home,/Land for what/)
})
test('project page describes real verification process and does not promise available inventory',()=>{
 const detail=src('pages/PropertyDetails.jsx')
 for(const text of ['aria-label="Breadcrumb"','What to check before reserving','Request a dated written quotation','Lot documents','details','summary','book-tripping?project=']) assert.ok(detail.includes(text),text)
 assert.doesNotMatch(detail,/\bguaranteed returns\b/i)
})
test('mobile site has booking/contact shortcuts without adding a backend',()=>{
 const layout=src('layouts/WebsiteLayout.jsx')
 const bar=src('components/MobileBookingBar.jsx')
 assert.match(layout,/<MobileBookingBar \/>/)
 assert.match(layout,/<ScrollReveal \/>/)
 assert.match(bar,/Quick contact actions/)
 assert.match(bar,/pathname==='\/book-tripping'/)
 assert.match(bar,/\/contact-us/)
})
test('reduced motion, responsive typography and accessible forms are preserved',()=>{
 const css=src('styles/website.css')
 const header=src('components/WebsiteHeader.jsx')
 const booking=src('pages/BookTripping.jsx')
 for(const x of ['.dc-mobile-actions','@media(max-width:670px)','prefers-reduced-motion:reduce','.dc-breadcrumb','.dc-information-grid','.dc-project-faq','.dc-hero-media']) assert.ok(css.includes(x),x)
 assert.match(header,/e\.key==='Escape'/)
 assert.match(booking,/min=\{dateToday\(\)\}/)
 assert.match(booking,/useEffect\(\(\)=>setForm/)
 assert.match(booking,/office must confirm/)
})
test('optimized sample WebP files exist and main hero is referenced',()=>{
 const paths=['scenic-hero-placeholder','scenic-maragondon-placeholder','scenic-bailen-placeholder','scenic-guide-placeholder']
 for(const name of paths){
  const img=`client/public/website/images/redesign/${name}.webp`
  assert.ok(has(img),img)
  assert.ok(fs.statSync(path.join(root,img)).size < 300_000,`large ${name}`)
 }
 assert.match(src('data/staticSite.js'),/prime-enclave-aerial\.webp/)
 assert.match(src('pages/Home.jsx'),/brand\.hero/)
})
test('internal portal paths are unchanged by public refinement',()=>{
 const app=read('client/src/App.jsx')
 assert.match(app,/path="\/portal" element=\{<Login \/>\}/)
 assert.match(app,/path="company-finances"/)
 assert.match(app,/path="employee-salary"/)
})
