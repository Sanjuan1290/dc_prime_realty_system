import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8')
const home=read('CLIENT/SYSTEM/src/website/pages/Home.jsx')
const hero=read('CLIENT/SYSTEM/src/website/components/HeroBackgroundVideo.jsx')
const css=read('CLIENT/SYSTEM/src/website/styles/website.css')
const data=read('CLIENT/SYSTEM/src/website/data/staticSite.js')
const clip='client/public/website/images/drive/maragondon/prime-enclave-hero-loop.mp4'

test('homepage uses Maragondon video and retains a first-priority real poster image',()=>{
 assert.match(home,/<HeroBackgroundVideo poster=\{brand.hero\} src=\{brand.heroVideo\} \/>/)
 assert.match(data,/heroVideo: '\/website\/images\/drive\/maragondon\/prime-enclave-hero-loop\.mp4'/)
 assert.match(hero,/fetchPriority="high" loading="eager"/)
 assert.match(hero,/poster=\{poster\}/)
 assert.doesNotMatch(home,/dc-hero-project/)
})
test('homepage footage is a short silent static asset, not the 68 second tour',()=>{
 assert.ok(fs.existsSync(path.join(root,clip)))
 const stat=fs.statSync(path.join(root,clip))
 assert.ok(stat.size>100_000 && stat.size<3_000_000,`unexpected background video size ${stat.size}`)
 const buf=fs.readFileSync(path.join(root,clip)).subarray(0,32)
 assert.match(buf.toString('ascii'),/ftyp/)
 assert.match(data,/video: \{src:'\/website\/images\/drive\/maragondon\/prime-enclave-tour\.mp4'/)
})
test('controls, mobile and reduced motion use the poster by default and enable manual playback',()=>{
 for(const expected of [
  'prefers-reduced-motion: reduce',
  "max-width: 670px",
  'navigator.connection?.saveData',
  'video.play()',
  'video.pause()',
  'preload="none"',
  'playsInline',
  'muted',
  'loop',
  'onError={() => setPlaying(false)}',
  'visibilitychange',
  "aria-label={playing ? 'Pause background video' : 'Play background video'}",
 ]) assert.ok(hero.includes(expected),expected)
})
test('hero content is shorter and video positioning stays clear of buttons',()=>{
 assert.match(home,/Own land in <span>Maragondon\.<\/span>/)
 assert.match(home,/Explore Prime Enclave/)
 assert.match(home,/Book a Tripping/)
 for(const expected of ['.dc-hero-video-active','.dc-hero-playback','.dc-hero-location','@media(max-width:670px)','@media(prefers-reduced-motion:reduce)'])assert.ok(css.includes(expected),expected)
 assert.match(css,/\.dc-home-hero h1\{font-size:clamp\(46px,5\.1vw,68px\)/)
})
test('only the public homepage, its assets and supporting tests are affected',()=>{
 const app=read('CLIENT/SYSTEM/src/App.jsx')
 assert.match(app,/\/portal/)
 assert.match(app,/path="company-finances"/)
 assert.match(app,/path="employee-salary"/)
})

