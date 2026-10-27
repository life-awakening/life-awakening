const assert = require('assert');
const squadScoringEngine = require('../services/squadScoringEngine');

console.log('================================================================');
console.log('RUNNING SQUAD FALL-IN TOP 3 BOYS/GIRLS WEIGHTED SCORING TESTS');
console.log('================================================================\n');

const mockDemographics = {
  totalBoys: 280,
  totalGirls: 95,
  squads: {
    'Aditya': { boys: 70, girls: 30 },
    'Bhaskar': { boys: 35, girls: 19 },
    'Dinkar': { boys: 25, girls: 10 },
    'Divakar': { boys: 40, girls: 38 },
    'Mitra': { boys: 20, girls: 5 },
    'Martand': { boys: 25, girls: 5 },
    'Prabhakar': { boys: 20, girls: 5 },
    'Ravi': { boys: 15, girls: 5 },
    'Surya': { boys: 15, girls: 5 },
    'Tejonidhi': { boys: 16, girls: 3 }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Top 3 Positions for Boys and Girls independently
// Example from user prompt:
// BOYS:
// 1st — Dinkar
// 2nd — Bhaskar
// 3rd — Aditya
//
// GIRLS:
// 1st — Bhaskar
// 2nd — Mitra
// 3rd — Dinkar
// ─────────────────────────────────────────────────────────────────────────────
console.log('Test 1: Top 3 Positions for Boys and Girls with Exact Medals and Weighted Scores (10/9/8 Multipliers)...');

const selectionsTop3 = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: 'Dinkar, Bhaskar, Aditya',    // Boys 1st (x10), 2nd (x9), 3rd (x8)
    second_squad: 'Bhaskar, Mitra, Dinkar'     // Girls 1st (x10), 2nd (x9), 3rd (x8)
  }
];

const res1 = squadScoringEngine.calculateSquadPerformance(selectionsTop3, mockDemographics);
const data1 = res1.squadData;

// Expected points (Internal squad gender proportion):
// Dinkar: Boys 1st (25/35 * 10 = 7.1429) + Girls 3rd (10/35 * 8 = 2.2857) = 9.4286 pts
const expectedDinkar = (25 / 35 * 10) + (10 / 35 * 8);
assert.ok(Math.abs(data1['Dinkar'].punc_fall_in_points - expectedDinkar) < 0.01, `Dinkar score must match ${expectedDinkar.toFixed(4)}, got ${data1['Dinkar'].punc_fall_in_points}`);
// Dinkar medals: 1 Gold (Highest Fall-In score: 9.4286)
assert.strictEqual(data1['Dinkar'].first_count, 1, 'Dinkar gets 1 Gold');
assert.strictEqual(data1['Dinkar'].second_count, 0, 'Dinkar gets 0 Silver');
assert.strictEqual(data1['Dinkar'].third_count, 0, 'Dinkar gets 0 Bronze');

// Bhaskar: Boys 2nd (35/54 * 9 = 5.8333) + Girls 1st (19/54 * 10 = 3.5185) = 9.3519 pts
const expectedBhaskar = (35 / 54 * 9) + (19 / 54 * 10);
assert.ok(Math.abs(data1['Bhaskar'].punc_fall_in_points - expectedBhaskar) < 0.01, `Bhaskar score must match ${expectedBhaskar.toFixed(4)}, got ${data1['Bhaskar'].punc_fall_in_points}`);
// Bhaskar medals: 1 Silver (2nd highest Fall-In score: 9.3519)
assert.strictEqual(data1['Bhaskar'].first_count, 0, 'Bhaskar gets 0 Gold');
assert.strictEqual(data1['Bhaskar'].second_count, 1, 'Bhaskar gets 1 Silver');
assert.strictEqual(data1['Bhaskar'].third_count, 0, 'Bhaskar gets 0 Bronze');

// Aditya: Boys 3rd (70/100 * 8 = 5.60) + Girls none (0) = 5.60 pts
const expectedAditya = (70 / 100 * 8);
assert.ok(Math.abs(data1['Aditya'].punc_fall_in_points - expectedAditya) < 0.01, `Aditya score must match ${expectedAditya.toFixed(4)}, got ${data1['Aditya'].punc_fall_in_points}`);
// Aditya medals: 1 Bronze (3rd highest Fall-In score: 5.60)
assert.strictEqual(data1['Aditya'].first_count, 0, 'Aditya gets 0 Gold');
assert.strictEqual(data1['Aditya'].second_count, 0, 'Aditya gets 0 Silver');
assert.strictEqual(data1['Aditya'].third_count, 1, 'Aditya gets 1 Bronze');

// Mitra: Boys none (0) + Girls 2nd (5/25 * 9 = 1.80) = 1.80 pts
const expectedMitra = (5 / 25 * 9);
assert.ok(Math.abs(data1['Mitra'].punc_fall_in_points - expectedMitra) < 0.01, `Mitra score must match ${expectedMitra.toFixed(4)}, got ${data1['Mitra'].punc_fall_in_points}`);
// Mitra medals: 0 medals (4th position)
assert.strictEqual(data1['Mitra'].first_count, 0, 'Mitra gets 0 Gold');
assert.strictEqual(data1['Mitra'].second_count, 0, 'Mitra gets 0 Silver');
assert.strictEqual(data1['Mitra'].third_count, 0, 'Mitra gets 0 Bronze');

console.log('  ✓ Dinkar: 1 Gold (9.43 pts)');
console.log('  ✓ Bhaskar: 1 Silver (9.35 pts)');
console.log('  ✓ Aditya: 1 Bronze (5.60 pts)');
console.log('  ✓ Mitra: Rank 4 (1.80 pts)');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Same squad winning 1st in Both Boys and Girls
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 2: Same squad winning 1st in both Boys and Girls...');

const selectionsSameWinner = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: 'Aditya, Bhaskar, Dinkar',
    second_squad: 'Aditya, Mitra, Divakar'
  }
];

const res2 = squadScoringEngine.calculateSquadPerformance(selectionsSameWinner, mockDemographics);
const aditya2 = res2.squadData['Aditya'];
const expectedAdityaBoth = (70 / 100 * 10) + (30 / 100 * 10); // 7.00 + 3.00 = 10.00
assert.ok(Math.abs(aditya2.punc_fall_in_points - expectedAdityaBoth) < 0.01);
assert.strictEqual(aditya2.first_count, 1, 'Aditya gets 1 Gold (Highest Fall-In Score)');
console.log(`  ✓ Aditya won 1st in Both: ${aditya2.punc_fall_in_points.toFixed(2)} pts and ${aditya2.first_count} Gold`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Backward Compatibility with legacy single winner selections
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 3: Backward compatibility with single squad string selections...');

const selectionsLegacy = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: 'Bhaskar',
    second_squad: 'Divakar'
  }
];

const res3 = squadScoringEngine.calculateSquadPerformance(selectionsLegacy, mockDemographics);
assert.ok(Math.abs(res3.squadData['Bhaskar'].punc_fall_in_points - (35 / 54 * 10)) < 0.01);
assert.strictEqual(res3.squadData['Bhaskar'].first_count, 1);
assert.ok(Math.abs(res3.squadData['Divakar'].punc_fall_in_points - (38 / 78 * 10)) < 0.01);
assert.strictEqual(res3.squadData['Divakar'].second_count, 1);
console.log('  ✓ Legacy single string format evaluates to Fall-In ranks seamlessly');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Punctuality Category and Overall Score Integration
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 4: Integration with Punctuality Category and Overall Score...');

const multiDaySelections = [
  // Day 2 Fall In: Top 3
  { batch_id: 1, day: 'Day 2', activity_title: 'Punctuality - Fall In', first_squad: 'Dinkar, Bhaskar, Aditya', second_squad: 'Bhaskar, Mitra, Dinkar' },
  // Day 2 Yoga: Aditya 1st (10), Bhaskar 2nd (9), Dinkar 3rd (8)
  { batch_id: 1, day: 'Day 2', activity_title: 'Punctuality - Yoga', first_squad: 'Aditya', second_squad: 'Bhaskar', third_squad: 'Dinkar' },
  // Day 3 Fall In: Aditya wins 1st in both
  { batch_id: 1, day: 'Day 3', activity_title: 'Punctuality - Fall In', first_squad: 'Aditya, Bhaskar, Dinkar', second_squad: 'Aditya, Divakar, Mitra' },
  // Day 5 Obstacle: All 10 squads
  { batch_id: 1, day: 'Day 5', activity_title: 'Obstacle', first_squad: 'Aditya, Bhaskar, Dinkar, Divakar, Mitra, Martand, Prabhakar, Ravi, Surya, Tejonidhi' }
];

const multiRes = squadScoringEngine.calculateSquadPerformance(multiDaySelections, mockDemographics);
const lb = multiRes.leaderboard;

assert.ok(lb.length === 10, 'Leaderboard contains all 10 squads');
assert.ok(lb[0].overall_score > 0, 'Rank #1 overall score is positive');
assert.strictEqual(lb.find(s => s.squad === 'Aditya').punctuality_rank, 1, 'Aditya has Punctuality Rank #1');
console.log(`  ✓ Leaderboard Rank #1: Squad ${lb[0].squad} (Overall Score: ${lb[0].overall_score.toFixed(2)}), Punctuality Winner: Aditya (Rank #1)`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: Excel Workbook Export with Top 3 Fall-In Results
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 5: Excel Workbook Export with Top 3 Fall-In Results...');

const excelBuf = squadScoringEngine.generateSquadPerformanceExcelBuffer({ name: 'Batch 42 - Top 3 Fall-In', year: 2026 }, multiRes);
assert.ok(Buffer.isBuffer(excelBuf), 'Excel output must be a valid Buffer');
assert.ok(excelBuf.length > 5000, `Excel file must have complete data (size: ${excelBuf.length} bytes)`);
console.log(`  ✓ Generated valid Excel workbook (${excelBuf.length} bytes) with 4 official sheets`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: Internal Squad Proportions (e.g. 70/30, 60/40, 45/55)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTest 6: Internal Squad Proportions (70/30, 60/40, 45/55)...');

const demoPrompt = {
  totalBoys: 175,
  totalGirls: 125,
  squads: {
    'Aditya': { boys: 70, girls: 30 },
    'Bhaskar': { boys: 60, girls: 40 },
    'Dinkar': { boys: 45, girls: 55 }
  }
};

const selPrompt = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: 'Aditya, Bhaskar, Dinkar',  // Boys: Aditya 1st (10), Bhaskar 2nd (9), Dinkar 1st (10)
    second_squad: 'Aditya, Bhaskar, Dinkar' // Girls: Aditya 1st (10), Bhaskar 2nd (9), Dinkar 5th (6)
  }
];

// Let's test custom positions
const customSel = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ 'Aditya': 1, 'Bhaskar': 1, 'Dinkar': 1 }),
    second_squad: JSON.stringify({ 'Aditya': 1, 'Bhaskar': 1, 'Dinkar': 5 })
  }
];

const res6 = squadScoringEngine.calculateSquadPerformance(customSel, demoPrompt);
const d6 = res6.squadData;

// Aditya: 70% * 10 + 30% * 10 = 10.00
assert.strictEqual(d6['Aditya'].punc_fall_in_points, 10.00);

// Bhaskar: 60% * 10 + 40% * 10 = 10.00
assert.strictEqual(d6['Bhaskar'].punc_fall_in_points, 10.00);

// Dinkar: 45% * 10 + 55% * 6 = 4.50 + 3.30 = 7.80
assert.strictEqual(d6['Dinkar'].punc_fall_in_points, 7.80);

console.log('  ✓ Aditya: 70/30 both Rank 1 -> 10.00 pts');
console.log('  ✓ Bhaskar: 60/40 both Rank 1 -> 10.00 pts');
console.log('  ✓ Dinkar: 45/55 Boys Rank 1, Girls Rank 5 -> 7.80 pts');

console.log('\n================================================================');
console.log('ALL SQUAD FALL-IN TESTS PASSED (6/6)!');
console.log('================================================================\n');
