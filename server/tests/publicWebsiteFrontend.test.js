import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

test('public website owns the root route while the internal system stays under /portal', () => {
  const app = read('client/src/App.jsx');
  assert.match(app, /<Route path="\/" element=\{<WebsiteLayout \/>\}/);
  assert.match(app, /<Route index element=\{<WebsiteHome \/>\}/);
  assert.match(app, /<Route path="properties" element=\{<WebsiteProperties \/>\}/);
  assert.match(app, /<Route path="properties\/:projectSlug"/);
  assert.match(app, /<Route path="blog\/:blogSlug"/);
  assert.match(app, /<Route path="\/portal" element=\{<Login \/>\}/);
  assert.match(app, /<Route path="\/buyer-form\/:token" element=\{<BuyerForm \/>\}/);
});

test('website pages, project data, blog content, and tripping rules are included', () => {
  const required = [
    'client/src/website/pages/Home.jsx',
    'client/src/website/pages/AboutUs.jsx',
    'client/src/website/pages/Properties.jsx',
    'client/src/website/pages/PropertyDetails.jsx',
    'client/src/website/pages/Blog.jsx',
    'client/src/website/pages/BlogDetails.jsx',
    'client/src/website/pages/FAQs.jsx',
    'client/src/website/pages/SiteCoordinator.jsx',
    'client/src/website/pages/Sellers.jsx',
    'client/src/website/pages/ContactUs.jsx',
  ];
  required.forEach((file) => assert.equal(exists(file), true, `${file} should exist`));

  const projects = read('client/src/website/data/projects.js');
  const blogs = read('client/src/website/data/blogs.js');
  const tripping = read('client/src/website/components/TrippingForm.jsx');
  assert.match(projects, /Luntiang Aguinaldo/);
  assert.match(projects, /Prime Enclave/);
  assert.match(projects, /Bailen, Cavite/);
  assert.match(projects, /Pantihan 4, Maragondon, Cavite/);
  assert.equal((blogs.match(/slug:/g) || []).length, 3);
  assert.match(tripping, /\['Tuesday', 'Thursday'\]/);
  assert.match(tripping, /frontend preview does not send or save the request/i);
});

test('uploaded property media is stored as local public assets', () => {
  const assets = [
    'client/public/website/videos/maragondon-hero.mp4',
    'client/public/website/images/bailen/luntiang-aguinaldo-cover.jpg',
    'client/public/website/images/maragondon/prime-enclave-cover.jpg',
    'client/public/website/images/company/office-team-collage.jpg',
    'client/public/website/images/coordinator/christopher-sarte-training.jpg',
  ];
  assets.forEach((file) => assert.equal(exists(file), true, `${file} should exist`));
});
