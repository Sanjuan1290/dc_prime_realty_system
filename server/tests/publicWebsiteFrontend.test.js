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

test('website redesign uses scoped typography and grouped navigation', () => {
  const css = read('client/src/website/styles/website.css');
  const header = read('client/src/website/components/WebsiteHeader.jsx');
  const navigation = read('client/src/website/data/company.js');
  const logo = read('client/src/website/components/BrandLogo.jsx');

  assert.match(css, /Libre Baskerville/);
  assert.match(css, /font-size:\s*15px/);
  assert.match(header, /NavigationDropdown/);
  assert.match(header, /mobileGroups/);
  assert.match(navigation, /label: 'Company'/);
  assert.match(navigation, /label: 'Resources'/);
  assert.match(logo, /dc-prime-logo\.svg/);
});

test('General Trias is coming soon and cannot be selected for tripping', () => {
  const projects = read('client/src/website/data/projects.js');
  const card = read('client/src/website/components/ProjectCard.jsx');
  const tripping = read('client/src/website/components/TrippingForm.jsx');
  const details = read('client/src/website/pages/PropertyDetails.jsx');

  assert.match(projects, /name: 'General Trias'/);
  assert.match(projects, /status: 'coming_soon'/);
  assert.match(projects, /bookingEnabled: false/);
  assert.match(card, /project\.status === 'coming_soon'/);
  assert.match(tripping, /projects\.filter\(\(project\) => project\.bookingEnabled\)/);
  assert.match(details, /project\.status === 'coming_soon'/);
  assert.match(tripping, /\['Tuesday', 'Thursday'\]/);
});

test('contact details, map, frontend email actions and updated team content are included', () => {
  const company = read('client/src/website/data/company.js');
  const contact = read('client/src/website/pages/ContactUs.jsx');
  const sellers = read('client/src/website/pages/Sellers.jsx');
  const coordinator = read('client/src/website/pages/SiteCoordinator.jsx');

  assert.match(company, /dcprimegold@gmail\.com/);
  assert.match(company, /facebook\.com\/dcprimerealtyOfficial/);
  assert.match(company, /google\.com\/maps\/embed/);
  assert.match(contact, /Prepare Email/);
  assert.match(contact, /mapEmbedUrl/);
  assert.doesNotMatch(sellers, /design placeholders/i);
  assert.doesNotMatch(coordinator, /christopher-sarte-training/);
});

test('uploaded property media and new brand assets are stored locally', () => {
  const assets = [
    'client/public/website/videos/maragondon-hero.mp4',
    'client/public/website/images/bailen/luntiang-aguinaldo-cover.jpg',
    'client/public/website/images/maragondon/prime-enclave-cover.jpg',
    'client/public/website/images/company/office-team-collage.jpg',
    'client/public/website/images/brand/dc-prime-logo.svg',
    'client/public/website/images/project-logos/luntiang-aguinaldo.svg',
    'client/public/website/images/project-logos/prime-enclave.svg',
    'client/public/website/images/project-logos/general-trias.svg',
    'client/public/website/images/general-trias/coming-soon.svg',
  ];
  assets.forEach((file) => assert.equal(exists(file), true, `${file} should exist`));
});

test('homepage header is transparent over the video and becomes solid after the hero', () => {
  const header = read('client/src/website/components/WebsiteHeader.jsx');
  const dropdown = read('client/src/website/components/NavigationDropdown.jsx');
  const home = read('client/src/website/pages/Home.jsx');

  assert.match(home, /id="home-video-hero"/);
  assert.match(header, /overVideoHero/);
  assert.match(header, /fixed left-0 right-0/);
  assert.match(header, /border-transparent bg-transparent shadow-none/);
  assert.match(header, /getElementById\('home-video-hero'\)/);
  assert.match(dropdown, /light = false/);
});


test('buyer tools, saved projects, comparison and legal pages are routed as frontend features', () => {
  const app = read('client/src/App.jsx');
  const properties = read('client/src/website/pages/Properties.jsx');
  const details = read('client/src/website/pages/PropertyDetails.jsx');
  const tripping = read('client/src/website/components/TrippingForm.jsx');
  const layout = read('client/src/website/layouts/WebsiteLayout.jsx');

  assert.match(app, /path="saved-projects"/);
  assert.match(app, /path="visit-checklist"/);
  assert.match(app, /path="payment-estimator"/);
  assert.match(app, /path="privacy-policy"/);
  assert.match(app, /path="terms-of-use"/);
  assert.match(app, /path="disclaimer"/);
  assert.match(properties, /ProjectComparison/);
  assert.match(properties, /Compare selected/);
  assert.match(details, /GalleryLightbox/);
  assert.match(details, /VisitChecklist/);
  assert.match(tripping, /Request summary/);
  assert.match(tripping, /Privacy Notice/);
  assert.match(layout, /ProjectPreferencesProvider/);
  assert.match(layout, /MobileActionBar/);
});

test('public website includes search, save, sharing and background-video controls', () => {
  const header = read('client/src/website/components/WebsiteHeader.jsx');
  const home = read('client/src/website/pages/Home.jsx');
  const card = read('client/src/website/components/ProjectCard.jsx');
  const details = read('client/src/website/pages/PropertyDetails.jsx');
  const blog = read('client/src/website/pages/Blog.jsx');

  assert.match(header, /SiteSearch/);
  assert.match(header, /savedSlugs/);
  assert.match(home, /Pause video/);
  assert.match(home, /BuyerProcess/);
  assert.match(card, /toggleSaved/);
  assert.match(details, /shareProject/);
  assert.match(details, /markRecentlyViewed/);
  assert.match(blog, /Search buyer guides/);
});
