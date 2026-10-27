import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const mediaPath=url=>path.join(root,'client/public',url.replace(/^\//,''));
const { brand,companyMedia,staticProjects } = await import('data:text/javascript;base64,'+Buffer.from(read('client/src/website/data/staticSite.js')).toString('base64'));
const files=[];
for(const project of staticProjects){files.push(project.image,project.video.src,...project.gallery.map(i=>i.src));}
files.push(brand.logo,brand.hero,companyMedia.team,companyMedia.event);

test('all website media assets exist in the packaged public folder',()=>{
 for(const url of files){assert.ok(url.startsWith('/website/images/'),`web asset path: ${url}`);assert.ok(fs.existsSync(mediaPath(url)),`missing asset: ${url}`);assert.ok(fs.statSync(mediaPath(url)).size>10000,`empty media: ${url}`);}
});
test('Prime Enclave remains first and references only Maragondon assets',()=>{
 const [prime]=staticProjects;assert.equal(prime.name,'Prime Enclave');assert.match(prime.city,/Maragondon/);
 for(const url of [prime.image,prime.video.src,...prime.gallery.map(x=>x.src)])assert.match(url,/\/drive\/maragondon\//);
 assert.equal(brand.hero,prime.image);
});
test('Bailen references only Bailen assets with a separate video',()=>{
 const bailen=staticProjects[1];assert.match(bailen.city,/Bailen/);
 for(const url of [bailen.image,bailen.video.src,...bailen.gallery.map(x=>x.src)])assert.match(url,/\/drive\/bailen\//);
 assert.notEqual(bailen.video.src,staticProjects[0].video.src);
});
test('photo placeholders are no longer the primary media of live pages',()=>{
 const home=read('client/src/website/pages/Home.jsx');const detail=read('client/src/website/pages/PropertyDetails.jsx');
 assert.doesNotMatch(home,/Illustrative landscape image · Replace/);
 assert.match(home,/src=\{brand.hero\}/);
 assert.match(detail,/project.gallery.map/);
 assert.doesNotMatch(detail,/SitePhoto alwaysSample/);
});
test('project videos use controls, on-demand preload, and per-project posters',()=>{
 const source=read('client/src/website/pages/PropertyDetails.jsx');
 assert.match(source,/<video controls playsInline preload="none" poster=\{project.image\}/);
 assert.match(source,/src=\{project.video.src\}/);
});
test('booking image and location follow the selected project',()=>{
 const source=read('client/src/website/pages/BookTripping.jsx');
 assert.match(source,/find\(p=>p.slug===form.project\)/);
 assert.match(source,/Selected: \{/);
});
test('project CTA includes project slug for booking',()=>{
 assert.match(read('client/src/website/components/StaticSiteUI.jsx'),/projectSlug \? `\/book-tripping\?project=\$\{projectSlug\}`/);
 assert.match(read('client/src/website/pages/PropertyDetails.jsx'),/<SiteCTA projectSlug=\{project.slug\}/);
});
test('authentic company photos used in about, seller and opportunities pages',()=>{
 for(const name of ['AboutUs','Sellers','Opportunities'])assert.match(read(`client/src/website/pages/${name}.jsx`),/companyMedia/);
});
test('no backend endpoint or portal routes changed by asset update',()=>{
 assert.equal(fs.existsSync(path.join(root,'client/src/App.jsx')),true);
 const app=read('client/src/App.jsx');assert.match(app,/\/portal/);
});
