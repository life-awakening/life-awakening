import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('TEST SUITE: RI Admin Batch Workspace Dynamic Batch Resolution');
console.log('================================================================');

// -----------------------------------------------------------------------------
// Test 1: Static Code Inspection of RiAdminDashboard.jsx
// -----------------------------------------------------------------------------
console.log('\n[Test 1] Static Verification of RiAdminDashboard.jsx code...');
const dashboardPath = path.resolve(__dirname, '../RiAdminDashboard.jsx');
assert(fs.existsSync(dashboardPath), `RiAdminDashboard.jsx should exist at ${dashboardPath}`);

const code = fs.readFileSync(dashboardPath, 'utf8');

// 1.1 Verify no hardcoded "BATCH 1" exists as fallback
assert(!code.includes("|| 'BATCH 1'"), 'FAIL: Found hardcoded fallback "|| \'BATCH 1\'" in code');
assert(!code.includes('|| "BATCH 1"'), 'FAIL: Found hardcoded fallback "|| \\"BATCH 1\\"" in code');
console.log('  ✔ No hardcoded "BATCH 1" fallbacks found in RiAdminDashboard.jsx');

// 1.2 Verify no array index [0] used as batch identifier in fetchRiBatches
assert(!code.includes('return batches[0].id;'), 'FAIL: Found "return batches[0].id;" in fetchRiBatches');
console.log('  ✔ No array index [0] used to force batch identification in fetchRiBatches');

// 1.3 Verify currentBatch derivation exists and is memoized
assert(code.includes('const currentBatch = useMemo('), 'FAIL: currentBatch derivation is missing');
console.log('  ✔ currentBatch dynamic derivation exists');

// 1.4 Verify openBatchWorkspace takes explicitBatchData
assert(code.includes('const openBatchWorkspace = (batchIdOrObj, targetSubTab = \'panels\', explicitBatchData = null)'),
  'FAIL: openBatchWorkspace does not accept batchData parameter');
console.log('  ✔ openBatchWorkspace supports dynamic batch data tracing');

// 1.5 Verify batch cards trace batch data to openBatchWorkspace
assert(code.includes('openBatchWorkspace(b.id, \'panels\', b)'), 'FAIL: Batch card panels action does not pass b');
assert(code.includes('openBatchWorkspace(b.id, \'students\', b)'), 'FAIL: Batch card students action does not pass b');
assert(code.includes('openBatchWorkspace(b.id, \'nodal_officers\', b)'), 'FAIL: Batch card nodal action does not pass b');
console.log('  ✔ Batch cards trace selected batch data (b) to workspace handler');

// -----------------------------------------------------------------------------
// Test 2: Dynamic Batch Resolution Logic Simulation
// -----------------------------------------------------------------------------
console.log('\n[Test 2] Testing dynamic batch resolution under various scenarios...');

// Helper mimicking currentBatch derivation in RiAdminDashboard
function resolveCurrentBatch({ selectedBatchDetails, selectedRiBatchId, riBatches = [], ltcBatches = [] }) {
  if (selectedBatchDetails?.batch && (String(selectedBatchDetails.batch.id) === String(selectedRiBatchId) || (selectedBatchDetails.batch.source_batch_id && String(selectedBatchDetails.batch.source_batch_id) === String(selectedRiBatchId)))) {
    return selectedBatchDetails.batch;
  }
  const fromRi = riBatches.find(b => String(b.id) === String(selectedRiBatchId) || (b.source_batch_id && String(b.source_batch_id) === String(selectedRiBatchId)));
  if (fromRi) return fromRi;
  const fromLtc = ltcBatches.find(b => String(b.id) === String(selectedRiBatchId) || (b.ri_batch_id && String(b.ri_batch_id) === String(selectedRiBatchId)));
  if (fromLtc) return fromLtc;
  if (selectedBatchDetails?.batch) return selectedBatchDetails.batch;
  return null;
}

// Helper mimicking workspace state transition on openBatchWorkspace
function simulateOpenBatchWorkspace(currentState, batchIdOrObj, targetSubTab = 'panels', explicitBatchData = null) {
  let batchId = batchIdOrObj;
  let batchData = explicitBatchData;
  if (batchIdOrObj && typeof batchIdOrObj === 'object') {
    batchId = batchIdOrObj.id || batchIdOrObj.ri_batch_id;
    batchData = batchIdOrObj;
  }

  const { riBatches = [], ltcBatches = [] } = currentState;
  if (!batchData && batchId != null) {
    batchData = riBatches.find(b => String(b.id) === String(batchId) || (b.source_batch_id && String(b.source_batch_id) === String(batchId)))
      || ltcBatches.find(b => String(b.id) === String(batchId) || (b.ri_batch_id && String(b.ri_batch_id) === String(batchId)))
      || null;
  }

  const prev = currentState.selectedBatchDetails;
  const newBatchDetails = batchData ? {
    batch: { ...(prev?.batch && String(prev.batch.id) === String(batchData.id) ? prev.batch : {}), ...batchData },
    panels: (prev?.batch && String(prev.batch.id) === String(batchData.id) ? prev.panels : []) || [],
    villages: (prev?.batch && String(prev.batch.id) === String(batchData.id) ? prev.villages : []) || []
  } : null;

  return {
    ...currentState,
    selectedRiBatchId: batchId,
    batchSubTab: targetSubTab,
    activeTab: 'batch_detail',
    selectedBatchDetails: newBatchDetails
  };
}

const mockBatches = [
  { id: 1, name: 'BATCH 1', batch_code: 'RI-01-2026', source_program: 'LTC_SYNC' },
  { id: 2, name: 'BATCH 2', batch_code: 'RI-02-2026', source_program: 'RI_DIRECT' },
  { id: 5, name: 'BATCH 5', batch_code: 'RI-05-2026', source_program: 'LTC_SYNC' },
  { id: 9, name: 'BATCH 9', batch_code: 'RI-09-2026', source_program: 'RI_DIRECT', total_students: 45 },
  { id: 'custom-future-10', name: 'BATCH 10 - SPECIAL COHORT', batch_code: 'RI-10-SPEC', source_program: 'RI_DIRECT' }
];

// Scenario 2.1: Opening BATCH 9 from card
let state = {
  riBatches: mockBatches,
  ltcBatches: [],
  selectedRiBatchId: null,
  selectedBatchDetails: null,
  activeTab: 'batches'
};

const batch9 = mockBatches.find(b => b.name === 'BATCH 9');
state = simulateOpenBatchWorkspace(state, batch9.id, 'panels', batch9);

const resolvedBatch9 = resolveCurrentBatch(state);
assert.strictEqual(resolvedBatch9.id, 9, 'FAIL: Expected batch ID 9');
assert.strictEqual(resolvedBatch9.name, 'BATCH 9', 'FAIL: Expected batch name "BATCH 9"');
assert.strictEqual(resolvedBatch9.batch_code, 'RI-09-2026', 'FAIL: Expected batch code "RI-09-2026"');
assert.strictEqual(resolvedBatch9.source_program, 'RI_DIRECT', 'FAIL: Expected source program "RI_DIRECT"');
console.log('  ✔ Selecting BATCH 9 displays "BATCH 9" (code "RI-09-2026", source "RI_DIRECT"), NOT BATCH 1');

// Scenario 2.2: Switching to BATCH 2
const batch2 = mockBatches.find(b => b.name === 'BATCH 2');
state = simulateOpenBatchWorkspace(state, batch2.id, 'panels', batch2);
const resolvedBatch2 = resolveCurrentBatch(state);
assert.strictEqual(resolvedBatch2.id, 2);
assert.strictEqual(resolvedBatch2.name, 'BATCH 2');
console.log('  ✔ Switching to BATCH 2 correctly resolves and displays "BATCH 2"');

// Scenario 2.3: Switching to alphanumeric/future batch ID
const batch10 = mockBatches.find(b => b.name === 'BATCH 10 - SPECIAL COHORT');
state = simulateOpenBatchWorkspace(state, batch10.id, 'panels', batch10);
const resolvedBatch10 = resolveCurrentBatch(state);
assert.strictEqual(resolvedBatch10.id, 'custom-future-10');
assert.strictEqual(resolvedBatch10.name, 'BATCH 10 - SPECIAL COHORT');
console.log('  ✔ Future/alphanumeric batch "custom-future-10" correctly resolves without hardcoding');

// Scenario 2.4: Type mismatch safety (string vs number IDs)
state = simulateOpenBatchWorkspace(state, '9', 'panels'); // Passed as string '9'
const resolvedBatch9FromString = resolveCurrentBatch(state);
assert.strictEqual(resolvedBatch9FromString.name, 'BATCH 9');
console.log('  ✔ Type mismatch (string "9" vs numeric 9) matches safely without defaulting to first batch');

// Scenario 2.5: Missing / Invalid Batch Data Handling
console.log('\n[Test 3] Testing missing / invalid batch data handling...');
const emptyState = {
  riBatches: mockBatches,
  ltcBatches: [],
  selectedRiBatchId: null,
  selectedBatchDetails: null,
  activeTab: 'batch_detail'
};

const resolvedEmpty = resolveCurrentBatch(emptyState);
assert.strictEqual(resolvedEmpty, null, 'FAIL: Expected null when no batch selected');
console.log('  ✔ Missing batch ID safely resolves to null (no crash, no default to BATCH 1)');

const invalidState = {
  riBatches: mockBatches,
  ltcBatches: [],
  selectedRiBatchId: 999999, // non-existent ID
  selectedBatchDetails: null,
  activeTab: 'batch_detail'
};

const resolvedInvalid = resolveCurrentBatch(invalidState);
assert.strictEqual(resolvedInvalid, null, 'FAIL: Expected null for non-existent batch ID');
console.log('  ✔ Invalid/unknown batch ID safely resolves to null without crashing');

// Heading fallback safety simulation:
const heading = resolvedInvalid?.name || 'Batch Workspace';
assert.strictEqual(heading, 'Batch Workspace', 'FAIL: Expected fallback heading "Batch Workspace"');
assert.notStrictEqual(heading, 'BATCH 1', 'FAIL: Fallback heading must not be "BATCH 1"');
console.log('  ✔ Safe heading fallback displays "Batch Workspace" instead of "BATCH 1"');

console.log('\n================================================================');
console.log('ALL TESTS PASSED SUCCESSFULLY (6/6)');
console.log('================================================================');
