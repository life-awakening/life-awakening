const assert = require('assert');
const squadScoringEngine = require('../services/squadScoringEngine');
const XLSX = require('xlsx');

console.log('--- STARTING DAY 5 OBSTACLE SCORING UNIT TESTS ---');

// 1. Verify Obstacle rule configuration
const rule = squadScoringEngine.getActivitySelectionRule('Obstacle');
const rulePlural = squadScoringEngine.getActivitySelectionRule('Obstacles');

assert.ok(rule, 'Obstacle rule must exist');
assert.strictEqual(rule.requiredDay, 'Day 5');
assert.strictEqual(rule.requiredCount, 10, 'Obstacle must require 10 squads');
assert.strictEqual(rule.isRanked, true, 'Obstacle must be marked as isRanked');
assert.strictEqual(rule.rank, 10);
assert.strictEqual(rulePlural.requiredCount, 10, 'Obstacles rule must require 10 squads');
console.log('✓ Test 1 Passed: Obstacle rule configuration allows all 10 squad rankings');

// 2. Simulate Day 5 Obstacle selection with all 10 squads in order
// Rank 1: Surya (10 pts)
// Rank 2: Bhaskar (9 pts)
// Rank 3: Aditya (8 pts)
// Rank 4: Prabhakar (7 pts)
// Rank 5: Dinkar (6 pts)
// Rank 6: Divakar (5 pts)
// Rank 7: Martand (4 pts)
// Rank 8: Ravi (3 pts)
// Rank 9: Mitra (2 pts)
// Rank 10: Tejonidhi (1 pt)
const orderedSquads = [
  'Surya', 'Bhaskar', 'Aditya', 'Prabhakar', 'Dinkar',
  'Divakar', 'Martand', 'Ravi', 'Mitra', 'Tejonidhi'
];

const mockSelections = [
  {
    batch_id: 1,
    day: 'Day 5',
    activity_title: 'Obstacle',
    first_squad: orderedSquads.join(', '),
    second_squad: 'Bhaskar',
    third_squad: 'Aditya',
    squad_name: orderedSquads.join(', '),
    is_locked: true,
    selected_at: new Date().toISOString()
  }
];

const result = squadScoringEngine.calculateSquadPerformance(mockSelections);
const { squadData, leaderboard, obstacleStandings } = result;

// 3. Verify Points Assignment (Rank 1=10, Rank 2=9, ..., Rank 10=1)
const expectedPoints = {
  Surya: 10,
  Bhaskar: 9,
  Aditya: 8,
  Prabhakar: 7,
  Dinkar: 6,
  Divakar: 5,
  Martand: 4,
  Ravi: 3,
  Mitra: 2,
  Tejonidhi: 1
};

orderedSquads.forEach((sq, idx) => {
  const rank = idx + 1;
  const expectedPts = expectedPoints[sq];
  assert.strictEqual(squadData[sq].obstacle_rank, rank, `${sq} must have obstacle_rank = ${rank}`);
  assert.strictEqual(squadData[sq].obstacle_points, expectedPts, `${sq} must have obstacle_points = ${expectedPts}`);
  assert.strictEqual(squadData[sq].rawCategoryScores.obstacles, expectedPts, `${sq} rawCategoryScores.obstacles must be ${expectedPts}`);
});
console.log('✓ Test 2 Passed: Points assignment matches Rank 1=10pts down to Rank 10=1pt');

// 4. Verify Weighted Scores (5% weight = rawScore * 0.05)
orderedSquads.forEach((sq) => {
  const expectedWeighted = Number((expectedPoints[sq] * 0.05).toFixed(4));
  assert.strictEqual(squadData[sq].categoryScores.obstacles, expectedWeighted, `${sq} weighted score must equal ${expectedWeighted}`);
  assert.strictEqual(squadData[sq].overall_score, Number(expectedWeighted.toFixed(2)), `${sq} overall score must equal ${expectedWeighted}`);
});
console.log('✓ Test 3 Passed: 5% Category Score and Overall Score correctly computed');

// 5. Verify Medals (Rank 1 = Gold, Rank 2 = Silver, Rank 3 = Bronze, Ranks 4-10 = no medal)
assert.strictEqual(squadData['Surya'].first_count, 1, 'Surya (Rank 1) must receive Gold');
assert.strictEqual(squadData['Surya'].dayStats['Day 5'].gold, 1);
assert.strictEqual(squadData['Surya'].medal_points, 10);

assert.strictEqual(squadData['Bhaskar'].second_count, 1, 'Bhaskar (Rank 2) must receive Silver');
assert.strictEqual(squadData['Bhaskar'].dayStats['Day 5'].silver, 1);
assert.strictEqual(squadData['Bhaskar'].medal_points, 9);

assert.strictEqual(squadData['Aditya'].third_count, 1, 'Aditya (Rank 3) must receive Bronze');
assert.strictEqual(squadData['Aditya'].dayStats['Day 5'].bronze, 1);
assert.strictEqual(squadData['Aditya'].medal_points, 8);

['Prabhakar', 'Dinkar', 'Divakar', 'Martand', 'Ravi', 'Mitra', 'Tejonidhi'].forEach(sq => {
  assert.strictEqual(squadData[sq].first_count, 0, `${sq} must not receive Gold`);
  assert.strictEqual(squadData[sq].second_count, 0, `${sq} must not receive Silver`);
  assert.strictEqual(squadData[sq].third_count, 0, `${sq} must not receive Bronze`);
  assert.strictEqual(squadData[sq].medal_points, 0, `${sq} must have 0 medal points`);
});
console.log('✓ Test 4 Passed: Medals correctly awarded only to Rank 1, 2, and 3');

// 6. Verify obstacleStandings output
assert.strictEqual(obstacleStandings.length, 10, 'obstacleStandings must contain all 10 squads');
assert.strictEqual(obstacleStandings[0].squad, 'Surya');
assert.strictEqual(obstacleStandings[0].rank, 1);
assert.strictEqual(obstacleStandings[0].points, 10);
assert.strictEqual(obstacleStandings[9].squad, 'Tejonidhi');
assert.strictEqual(obstacleStandings[9].rank, 10);
assert.strictEqual(obstacleStandings[9].points, 1);
console.log('✓ Test 5 Passed: obstacleStandings list correctly ordered 1 to 10');

// 7. Verify Excel Export Buffer generation & sheets
const batchInfo = { name: 'Batch 2026 Immersion', year: 2026 };
const excelBuffer = squadScoringEngine.generateSquadPerformanceExcelBuffer(batchInfo, result);
assert.ok(excelBuffer && excelBuffer.length > 0, 'Excel buffer must be generated');

const wb = XLSX.read(excelBuffer, { type: 'buffer' });
assert.ok(wb.SheetNames.includes('Overall Score'), 'Must include Overall Score sheet');
assert.ok(wb.SheetNames.includes('Scorecard'), 'Must include Scorecard sheet');
assert.ok(wb.SheetNames.includes('Leaderboard'), 'Must include Leaderboard sheet');
assert.ok(wb.SheetNames.includes('Obstacle Standings'), 'Must include Obstacle Standings sheet');

// Check Obstacle Standings sheet content
const obstSheet = wb.Sheets['Obstacle Standings'];
const obstData = XLSX.utils.sheet_to_json(obstSheet, { header: 1 });
assert.ok(obstData.length >= 15, 'Obstacle sheet must contain rows for title, headers, and 10 squads');
console.log('✓ Test 6 Passed: Excel Export contains Obstacle Standings sheet and accurate results');

console.log('==============================================');
console.log('ALL DAY 5 OBSTACLE SCORING TESTS PASSED!');
console.log('==============================================');
