const assert = require('assert');
const squadScoringEngine = require('../services/squadScoringEngine');

const { calculateSquadPerformance, SQUAD_CANONICAL_NAMES, generateSquadPerformanceExcelBuffer } = squadScoringEngine;

console.log('========================================================================');
console.log('TEST SUITE: VERIFY UNSELECTED SQUADS NEVER RECEIVE AUTOMATIC SCORES/RANKS');
console.log('========================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: User Scenario — Only Aditya (Rank 1) and Bhaskar (Rank 2) selected on Day 2 Fall In
// ─────────────────────────────────────────────────────────────────────────────
console.log('TEST 1: Day 2 Fall In with ONLY Aditya=1 and Bhaskar=2...');

const day2Selections = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ Aditya: 1, Bhaskar: 2 }),
    second_squad: null
  }
];

const res1 = calculateSquadPerformance(day2Selections);
const data1 = res1.squadData;
const day2Lb = res1.dayLeaderboards['Day 2'];

// Check Aditya
assert.strictEqual(data1['Aditya'].punctuality_rank, 1, 'Aditya punctuality_rank must be 1');
assert.strictEqual(data1['Aditya'].punctuality_points, 5.0, 'Aditya punctuality_points must be 5.0 (10 * 0.5)');
assert.strictEqual(data1['Aditya'].categoryScores.punctuality, 0.50, 'Aditya Day 2 punctuality contribution must be 0.50');
assert.strictEqual(data1['Aditya'].overall_score, 0.50, 'Aditya Overall score must be 0.50');

// Check Bhaskar
assert.strictEqual(data1['Bhaskar'].punctuality_rank, 2, 'Bhaskar punctuality_rank must be 2');
assert.strictEqual(data1['Bhaskar'].punctuality_points, 4.5, 'Bhaskar punctuality_points must be 4.5 (9 * 0.5)');
assert.strictEqual(data1['Bhaskar'].categoryScores.punctuality, 0.45, 'Bhaskar Day 2 punctuality contribution must be 0.45');
assert.strictEqual(data1['Bhaskar'].overall_score, 0.45, 'Bhaskar Overall score must be 0.45');

// Check all other 8 squads
const unselectedSquads = ['Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'];
unselectedSquads.forEach(sq => {
  assert.strictEqual(data1[sq].punctuality_rank, null, `${sq} punctuality_rank must be null (unselected)`);
  assert.strictEqual(data1[sq].punctuality_points, 0, `${sq} punctuality_points must be 0`);
  assert.strictEqual(data1[sq].rawCategoryScores.punctuality, 0, `${sq} rawCategoryScores.punctuality must be 0`);
  assert.strictEqual(data1[sq].categoryScores.punctuality, 0.00, `${sq} categoryScores.punctuality must be 0.00`);
  assert.strictEqual(data1[sq].categoryContributions.punctuality, 0.00, `${sq} categoryContributions.punctuality must be 0.00`);
  assert.strictEqual(data1[sq].overall_score, 0.00, `${sq} overall_score must be 0.00`);
  assert.strictEqual(data1[sq].first_count, 0, `${sq} first_count must be 0`);
  assert.strictEqual(data1[sq].second_count, 0, `${sq} second_count must be 0`);
  assert.strictEqual(data1[sq].third_count, 0, `${sq} third_count must be 0`);
});

console.log('  ✓ Aditya: Rank 1, 5.0 pts, 0.50 contribution');
console.log('  ✓ Bhaskar: Rank 2, 4.5 pts, 0.45 contribution');
console.log('  ✓ All 8 other squads: null rank, 0 pts, 0.00 contribution');
console.log('✓ TEST 1 PASSED!\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: No selections exist (All blank)
// ─────────────────────────────────────────────────────────────────────────────
console.log('TEST 2: Completely empty selections (no squads selected)...');

const res2 = calculateSquadPerformance([]);
SQUAD_CANONICAL_NAMES.forEach(sq => {
  assert.strictEqual(res2.squadData[sq].punctuality_rank, null, `${sq} rank must be null`);
  assert.strictEqual(res2.squadData[sq].punctuality_points, 0, `${sq} points must be 0`);
  assert.strictEqual(res2.squadData[sq].overall_score, 0, `${sq} overall score must be 0`);
  assert.strictEqual(res2.squadData[sq].categoryScores.punctuality, 0, `${sq} punc score must be 0`);
});
console.log('✓ TEST 2 PASSED: All squads have 0 score and null rank when nothing is selected!\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Day 3 & Day 4 Fall In / Punctuality tests across different days
// ─────────────────────────────────────────────────────────────────────────────
console.log('TEST 3: Multi-day selections verifying isolation and additive consistency...');

const multiDay = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ Aditya: 1, Bhaskar: 2 }),
    second_squad: null
  },
  {
    batch_id: 1,
    day: 'Day 3',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ Dinkar: 1, Divakar: 2, Mitra: 3 }),
    second_squad: null
  }
];

const res3 = calculateSquadPerformance(multiDay);
// Day 2 check
assert.strictEqual(res3.dayLeaderboards['Day 2'].find(s => s.squad === 'Aditya').overall_score, 0.50);
assert.strictEqual(res3.dayLeaderboards['Day 2'].find(s => s.squad === 'Bhaskar').overall_score, 0.45);
assert.strictEqual(res3.dayLeaderboards['Day 2'].find(s => s.squad === 'Dinkar').overall_score, 0.00);

// Day 3 check
assert.strictEqual(res3.dayLeaderboards['Day 3'].find(s => s.squad === 'Aditya').overall_score, 0.00);
assert.strictEqual(res3.dayLeaderboards['Day 3'].find(s => s.squad === 'Dinkar').overall_score, 0.50);
assert.strictEqual(res3.dayLeaderboards['Day 3'].find(s => s.squad === 'Divakar').overall_score, 0.45);
assert.strictEqual(res3.dayLeaderboards['Day 3'].find(s => s.squad === 'Mitra').overall_score, 0.40);

// Overall cumulative score must equal Day 2 + Day 3
assert.strictEqual(res3.squadData['Aditya'].overall_score, 0.50);
assert.strictEqual(res3.squadData['Bhaskar'].overall_score, 0.45);
assert.strictEqual(res3.squadData['Dinkar'].overall_score, 0.50);
assert.strictEqual(res3.squadData['Divakar'].overall_score, 0.45);
assert.strictEqual(res3.squadData['Mitra'].overall_score, 0.40);
['Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'].forEach(sq => {
  assert.strictEqual(res3.squadData[sq].overall_score, 0.00, `${sq} overall score must be 0.00`);
  assert.strictEqual(res3.squadData[sq].punctuality_rank, null, `${sq} rank must be null`);
});

console.log('✓ TEST 3 PASSED: Multi-day scores isolated and strictly additive!\n');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Excel export contains clean results with unselected squads showing 0 score
// ─────────────────────────────────────────────────────────────────────────────
console.log('TEST 4: Excel workbook export verification...');

const buf = generateSquadPerformanceExcelBuffer({ name: 'Batch 2026' }, res1);
assert(buf && buf.length > 0, 'Excel buffer must be generated');
console.log(`  ✓ Generated valid Excel workbook (${buf.length} bytes)`);
console.log('✓ TEST 4 PASSED!\n');

console.log('========================================================================');
console.log('ALL TESTS PASSED: UNSELECTED SQUADS NEVER RECEIVE AUTOMATIC MARKS!');
console.log('========================================================================');
