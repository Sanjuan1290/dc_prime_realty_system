import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Lot Project dashboard initializes to This Month and View Details print opens the Price List modal', async () => {
  const [dashboard, details] = await Promise.all([
    read('../../client/src/pages/Lot_Projects/Dashboard.jsx'),
    read('../../client/src/components/Lot_Projects/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal.jsx'),
  ]);

  assert.match(dashboard, /defaultDateRange = \(\) => resolvePresetDateRange\('this_month'\)/);
  assert.match(dashboard, /useState\('this_month'\)/);
  assert.doesNotMatch(dashboard, /useState\('3_months'\)/);
  assert.match(details, /onClick=\{onPrintPriceList\}[\s\S]*?Print Price List/);
  assert.match(dashboard, /onPrintPriceList=\{\(\) => \{ setShowDetails\(false\); setShowPriceListModal\(true\) \}\}/);
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

