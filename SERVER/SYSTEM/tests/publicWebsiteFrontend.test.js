import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const read=p=>fs.readFileSync(path.join(root,p),'utf8')
const exists=p=>fs.existsSync(path.join(root,p))

test('public site routes are owned by WEBSITE; SYSTEM still owns internal routes',()=>{
 const website=read('CLIENT/WEBSITE/src/App.jsx')
 for(const url of ['about-us','properties','properties/:projectSlug','blog','blog/:blogSlug','sellers','opportunities','contact-us','book-tripping']){
   assert.ok(website.includes(`<Route path="${url}"`), `missing WEBSITE route ${url}`)
 }
 assert.match(website, /<Route index element=\{<Home \/>\}/)
 const system=read('CLIENT/SYSTEM/src/App.jsx')
 assert.match(system,/path="\/portal" element=\{<Login \/>\}/)
 assert.match(system,/path="\/buyer-form\/:token"/)
 assert.doesNotMatch(system,/path="about-us"/)
})

test('site features only two lot projects, and Maragondon comes first',()=>{
 const site=read('CLIENT/WEBSITE/src/website/data/staticSite.js')
 assert.match(site,/slug: 'prime-enclave-maragondon'/)
 assert.match(site,/slug: 'luntiang-aguinaldo-bailen'/)
 assert.ok(site.indexOf("slug: 'prime-enclave-maragondon'")<site.indexOf("slug: 'luntiang-aguinaldo-bailen'"))
 assert.doesNotMatch(site,/general-trias-coming-soon/)
 const old=read('CLIENT/WEBSITE/src/website/data/projects.js')
 assert.doesNotMatch(old,/slug: 'general-trias-coming-soon'/)
})

test('site header uses the original gold logo, new navigation and responsive mobile menu',()=>{
 const header=read('CLIENT/WEBSITE/src/website/components/WebsiteHeader.jsx')
 const logo=read('CLIENT/WEBSITE/src/website/components/BrandLogo.jsx')
 const data=read('CLIENT/WEBSITE/src/website/data/staticSite.js')
 const css=read('CLIENT/WEBSITE/src/website/styles/website.css')
 for(const label of ['Home','About','Projects','Blogs','Sellers','Opportunities','Contact']) assert.match(data,new RegExp(`title: '${label}'`))
 assert.match(data,/dc-prime-logo-gold\.png/)
 assert.match(logo,/brand\.logo/)
 assert.match(header,/aria-expanded=\{open\}/)
 assert.match(header,/\/book-tripping/)
 assert.match(css,/font-family:'Manrope'/)
 assert.match(css,/@media \(max-width:670px\)/)
 assert.doesNotMatch(css,/Libre Baskerville/)
 assert.ok(exists('CLIENT/WEBSITE/public/website/images/redesign/dc-prime-logo-gold.png'))
})

test('every requested public page has content, metadata, and static-first design',()=>{
 const files=['Home','AboutUs','Properties','PropertyDetails','Blog','BlogDetails','Sellers','Opportunities','ContactUs','BookTripping']
 for(const f of files){const text=read(`CLIENT/WEBSITE/src/website/pages/${f}.jsx`); assert.match(text,/usePageMeta/); assert.match(text,/export default/);assert.doesNotMatch(text,/useFetch|axios|fetch\(|\.post\(/)}
 const booking=read('CLIENT/WEBSITE/src/website/pages/BookTripping.jsx')
 const contact=read('CLIENT/WEBSITE/src/website/pages/ContactUs.jsx')
 assert.match(booking,/emailRequest/)
 assert.match(contact,/emailRequest/)
 assert.match(booking,/office must confirm/i)
 assert.match(booking,/type="date"/)
 assert.match(booking,/type="checkbox"/)
 assert.match(contact,/type="email"/)
})

test('real Maragondon media, truthful fallbacks, and public navigation remain intact',()=>{
 const header=read('CLIENT/WEBSITE/src/website/components/WebsiteHeader.jsx')
 const footer=read('CLIENT/WEBSITE/src/website/components/WebsiteFooter.jsx')
 const photo=read('CLIENT/WEBSITE/src/website/components/StaticSiteUI.jsx')
 const home=read('CLIENT/WEBSITE/src/website/pages/Home.jsx')
 const hero=read('CLIENT/WEBSITE/src/website/components/HeroBackgroundVideo.jsx')
 const data=read('CLIENT/WEBSITE/src/website/data/staticSite.js')

 // Authentic project photography has replaced the earlier illustrative homepage hero.
 assert.match(home,/<HeroBackgroundVideo poster=\{brand\.hero\} src=\{brand\.heroVideo\}/)
 assert.match(home,/Actual Prime Enclave footage and photography/)
 assert.doesNotMatch(home,/Illustrative landscape image/)
 assert.match(data,/hero: '\/website\/images\/drive\/maragondon\/prime-enclave-aerial\.webp'/)
 assert.match(data,/heroVideo: '\/website\/images\/drive\/maragondon\/prime-enclave-hero-loop\.mp4'/)
 for(const name of ['prime-enclave-aerial.webp','prime-enclave-hero-loop.mp4']) {
   const file=`CLIENT/WEBSITE/public/website/images/drive/maragondon/${name}`
   assert.ok(exists(file),`Missing Maragondon homepage media: ${file}`)
   assert.ok(fs.statSync(path.join(root,file)).size>10000,`Empty media: ${file}`)
 }

 // If a real image fails to load, the UI must identify the fallback as illustrative.
 assert.match(photo,/Illustrative image/)
 assert.match(photo,/onError=/)
 assert.match(photo,/setSample\(true\)/)
 assert.match(hero,/poster=\{poster\}/)
 for(const name of ['scenic-maragondon-placeholder.webp','scenic-bailen-placeholder.webp']) {
   assert.ok(exists(`CLIENT/WEBSITE/public/website/images/redesign/${name}`),`Missing fallback: ${name}`)
 }
 // Public navigation must not expose the authenticated employee/realty portal.
 assert.doesNotMatch(header+footer,/to="\/portal"/)
})



