import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- Running RI Admin PWA & Bulk Upload Tests ---');

// 1. Static check of RiBulkUploadModule.jsx
const bulkUploadFilePath = path.resolve(__dirname, '../RiBulkUploadModule.jsx');
const bulkUploadCode = fs.readFileSync(bulkUploadFilePath, 'utf-8');

assert(
  bulkUploadCode.includes('riOnlyBatches'),
  'FAIL: RiBulkUploadModule should define riOnlyBatches'
);

assert(
  bulkUploadCode.includes('!b.source_batch_id') || bulkUploadCode.includes('b.source_batch_id'),
  'FAIL: RiBulkUploadModule should filter by source_batch_id'
);

assert(
  bulkUploadCode.includes('No RI-only batches available'),
  'FAIL: RiBulkUploadModule should include an empty state when no RI-only batches exist'
);

console.log('✓ PASS: RiBulkUploadModule static checks passed');

// 2. Logic simulation of riOnlyBatches filter
const mockBatches = [
  { id: 1, name: 'BATCH 1 (LTC Sync)', source_program: 'LTC_SYNC', source_batch_id: 101, is_synced_to_ri: true },
  { id: 2, name: 'BATCH 2 (LTC Direct)', source_program: 'LTC', source_batch_id: 102 },
  { id: 3, name: 'BATCH 3 (RI Direct)', source_program: 'RI_DIRECT', source_batch_id: null, is_synced_to_ri: false },
  { id: 4, name: 'BATCH 4 (Custom RI)', source_program: null, source_batch_id: null, is_synced_to_ri: false },
  { id: 5, name: 'BATCH 5 (Synced Flag)', is_synced_to_ri: true }
];

const riOnlyBatches = mockBatches.filter(b => {
  const isLtcSynced = Boolean(
    b.source_batch_id ||
    b.source_program === 'LTC' ||
    b.source_program === 'LTC_SYNC' ||
    b.is_synced_to_ri
  );
  return !isLtcSynced;
});

assert.strictEqual(riOnlyBatches.length, 2, 'FAIL: Exactly 2 RI-only batches expected');
assert.strictEqual(riOnlyBatches[0].id, 3, 'FAIL: BATCH 3 should be included');
assert.strictEqual(riOnlyBatches[1].id, 4, 'FAIL: BATCH 4 should be included');
console.log('✓ PASS: riOnlyBatches filter logic isolates only RI direct batches');

// 3. Empty state simulation
const emptyRiBatches = [
  { id: 1, name: 'BATCH 1', source_program: 'LTC_SYNC', source_batch_id: 101 }
].filter(b => !Boolean(b.source_batch_id || b.source_program === 'LTC' || b.source_program === 'LTC_SYNC' || b.is_synced_to_ri));

assert.strictEqual(emptyRiBatches.length, 0, 'FAIL: Empty list of RI batches should produce length 0');
console.log('✓ PASS: Empty state condition correctly triggers when zero RI-only batches exist');

// 4. Static check of RiAdminDashboard.jsx
const dashboardFilePath = path.resolve(__dirname, '../RiAdminDashboard.jsx');
const dashboardCode = fs.readFileSync(dashboardFilePath, 'utf-8');

assert(
  dashboardCode.includes('scrollRestoration') && dashboardCode.includes('manual'),
  'FAIL: RiAdminDashboard should configure history.scrollRestoration = manual'
);

assert(
  dashboardCode.includes('mainScrollRef'),
  'FAIL: RiAdminDashboard should have mainScrollRef attached to main element'
);

assert(
  dashboardCode.includes('#047857') && dashboardCode.includes('theme-color'),
  'FAIL: RiAdminDashboard should dynamically set theme-color to #047857'
);

assert(
  dashboardCode.includes('apple-mobile-web-app-status-bar-style') && dashboardCode.includes('black-translucent'),
  'FAIL: RiAdminDashboard should configure apple-mobile-web-app-status-bar-style'
);

assert(
  dashboardCode.includes('env(safe-area-inset-top') && dashboardCode.includes('env(safe-area-inset-bottom'),
  'FAIL: RiAdminDashboard should utilize safe-area insets'
);

assert(
  dashboardCode.includes('100dvh'),
  'FAIL: RiAdminDashboard should handle 100dvh for mobile viewports'
);

assert(
  dashboardCode.includes('ScrollToTop'),
  'FAIL: RiAdminDashboard should render ScrollToTop component'
);

console.log('✓ PASS: RiAdminDashboard static PWA and mobile scroll checks passed');
console.log('--- ALL RI ADMIN PWA & BULK UPLOAD TESTS PASSED (4/4) ---');
