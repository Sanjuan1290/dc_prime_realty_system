import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Lot Project Reports initializes to This Month while Dashboard owns project actions and listings owns Price List', async () => {
  const [reports, dashboard, details] = await Promise.all([
    read('../../../CLIENT/SYSTEM/src/pages/Lot_Projects/Reports.jsx'),
    read('../../../CLIENT/SYSTEM/src/pages/Lot_Projects/Dashboard.jsx'),
    read('../../../CLIENT/SYSTEM/src/components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal.jsx'),
  ]);

  assert.match(reports, /defaultDateRange = \(\) => resolvePresetDateRange\('this_month'\)/);
  assert.match(reports, /useState\('this_month'\)/);
  assert.doesNotMatch(reports, /useState\('3_months'\)/);
  assert.match(dashboard, />View Details<\/button>/);
  assert.match(dashboard, />Edit Project<\/button>/);
  assert.doesNotMatch(dashboard, />Price List<\/button>/);
  assert.match(details, /onClick=\{onGoListings\}[\s\S]*?Open Listings/);
  assert.match(dashboard, /onGoListings/);
  assert.doesNotMatch(reports, />View Details<\/button>/);
  assert.doesNotMatch(reports, />Edit Project<\/button>/);
  assert.doesNotMatch(reports, />Price List<\/button>/);
});

test('commission rate examples are field-authored instead of inheriting the daily penalty sample', async () => {
  const [decorator, projectRates] = await Promise.all([
    read('../../../CLIENT/SYSTEM/src/components/Shared/InputExampleDecorator.jsx'),
    read('../../../CLIENT/SYSTEM/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx'),
  ]);

  assert.match(projectRates, /data-example="8%"/);
  assert.match(projectRates, /data-example="2%"/);
  assert.match(projectRates, /Company Profit \(CP\)/);
  assert.match(projectRates, /14\.18/);
  assert.match(projectRates, /50/);
  assert.match(decorator, /getAttribute\('data-example'\)/);
  assert.doesNotMatch(decorator, /if \(\/rate\|percentage\|percent[\s\S]*?return '0\.05%'/);
  assert.doesNotMatch(decorator, /custom\.\*daily\.\*penalty\.\*rate/);
});




