import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Lot Project Reports initializes to This Month while Dashboard owns project actions and Price List', async () => {
  const [reports, dashboard, details] = await Promise.all([
    read('../../client/src/pages/Lot_Projects/Reports.jsx'),
    read('../../client/src/pages/Lot_Projects/Dashboard.jsx'),
    read('../../client/src/components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal.jsx'),
  ]);

  assert.match(reports, /defaultDateRange = \(\) => resolvePresetDateRange\('this_month'\)/);
  assert.match(reports, /useState\('this_month'\)/);
  assert.doesNotMatch(reports, /useState\('3_months'\)/);
  assert.match(dashboard, />View Details<\/button>/);
  assert.match(dashboard, />Edit Project<\/button>/);
  assert.match(dashboard, />Price List<\/button>/);
  assert.match(details, /onClick=\{onPrintPriceList\}[\s\S]*?Print Price List/);
  assert.match(dashboard, /onPrintPriceList=\{\(\) => \{ setShowDetails\(false\); setShowPriceListModal\(true\) \}\}/);
  assert.doesNotMatch(reports, />View Details<\/button>/);
  assert.doesNotMatch(reports, />Edit Project<\/button>/);
  assert.doesNotMatch(reports, />Price List<\/button>/);
});

test('commission rate examples are field-authored instead of inheriting the daily penalty sample', async () => {
  const [decorator, projectRates] = await Promise.all([
    read('../../client/src/components/Shared/InputExampleDecorator.jsx'),
    read('../../client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx'),
  ]);

  assert.match(projectRates, /data-example="8%"/);
  assert.match(projectRates, /'division_manager_rate', 'Division Manager Rate', '1%'/);
  assert.match(projectRates, /'sales_agent_rate', 'Sales Agent Rate', '5%'/);
  assert.match(projectRates, /data-example=\{example\}/);
  assert.match(decorator, /getAttribute\('data-example'\)/);
  assert.doesNotMatch(decorator, /if \(\/rate\|percentage\|percent[\s\S]*?return '0\.05%'/);
  assert.doesNotMatch(decorator, /custom\.\*daily\.\*penalty\.\*rate/);
});
