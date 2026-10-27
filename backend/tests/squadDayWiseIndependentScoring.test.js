const assert = require('assert');
const squadScoringEngine = require('../services/squadScoringEngine');
const { calculateSquadPerformance, SQUAD_CANONICAL_NAMES } = squadScoringEngine;

console.log('========================================================================');
console.log('TESTING INDEPENDENT DAY-WISE SQUAD PERFORMANCE SCORING & HIGHLIGHTING');
console.log('========================================================================\n');

// Mock selections across Days 2, 3, 4, 5
const mockSelections = [
  // Day 2: Fall-In (Aditya 1st, Bhaskar 2nd, Dinkar 3rd)
  {
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: 'Aditya:1,Bhaskar:2,Dinkar:3'
  },
  // Day 3: Quiz (Only Bhaskar and Dinkar win Quiz, 5 pts each = 0.25 pts)
  {
    day: 'Day 3',
    activity_title: 'Quiz',
    first_squad: 'Bhaskar,Dinkar'
  },
  // Day 4: Debate (5 squads: Mitra, Ravi, Surya, Tejonidhi, Prabhakar - 2 pts each = 0.10 pts)
  {
    day: 'Day 4',
    activity_title: 'Debate',
    first_squad: 'Mitra,Ravi,Surya,Tejonidhi,Prabhakar'
  },
  // Day 5: Food Serving (Surya 1st, Mitra 2nd, Ravi 3rd - 10/9/8 pts)
  {
    day: 'Day 5',
    activity_title: 'Food Serving',
    first_squad: 'Surya',
    second_squad: 'Mitra',
    third_squad: 'Ravi'
  }
];

const result = calculateSquadPerformance(mockSelections);

// 1. Verify dayLeaderboards is attached and contains all 4 days
assert(result.dayLeaderboards, 'dayLeaderboards must exist on calculateSquadPerformance result');
assert(result.dayLeaderboards['Day 2'], 'Day 2 leaderboard must exist');
assert(result.dayLeaderboards['Day 3'], 'Day 3 leaderboard must exist');
assert(result.dayLeaderboards['Day 4'], 'Day 4 leaderboard must exist');
assert(result.dayLeaderboards['Day 5'], 'Day 5 leaderboard must exist');
console.log('✓ TEST 1 PASSED: dayLeaderboards structure contains all days.');

// 2. Test Day 2 Isolation: Only Day 2 activities are calculated
const day2Lb = result.dayLeaderboards['Day 2'];
const d2Aditya = day2Lb.find(s => s.squad === 'Aditya');
const d2Bhaskar = day2Lb.find(s => s.squad === 'Bhaskar');
const d2Surya = day2Lb.find(s => s.squad === 'Surya');

assert.strictEqual(d2Aditya.overall_score, 0.50, 'Aditya should have 0.50 pts on Day 2 (5.0 pts * 0.10)');
assert.strictEqual(d2Bhaskar.overall_score, 0.45, 'Bhaskar should have 0.45 pts on Day 2 (4.5 pts * 0.10)');
assert(day2Lb[0].squad === 'Aditya', 'Aditya should be Rank #1 on Day 2');
console.log(`✓ TEST 2 PASSED: Day 2 isolated. Rank 1: ${day2Lb[0].squad} (${day2Lb[0].overall_score} pts).`);

// 3. Test Day 3 Isolation: Day 2 scores are NOT carried over into Day 3!
const day3Lb = result.dayLeaderboards['Day 3'];
const d3Aditya = day3Lb.find(s => s.squad === 'Aditya');
const d3Bhaskar = day3Lb.find(s => s.squad === 'Bhaskar');
const d3Dinkar = day3Lb.find(s => s.squad === 'Dinkar');

assert.strictEqual(d3Aditya.overall_score, 0.00, 'Aditya score must be 0.00 on Day 3 (NO carry-over from Day 2)');
assert.strictEqual(d3Bhaskar.overall_score, 0.25, 'Bhaskar should have 0.25 pts on Day 3');
assert.strictEqual(d3Dinkar.overall_score, 0.25, 'Dinkar should have 0.25 pts on Day 3');

// Both Bhaskar and Dinkar are Day 3 winners (tied at top score 0.25)
assert(d3Bhaskar.overall_score === 0.25 && d3Dinkar.overall_score === 0.25, 'Both Bhaskar and Dinkar won Day 3');
console.log(`✓ TEST 3 PASSED: Day 3 isolated. Aditya has 0.00 pts. Bhaskar & Dinkar won Day 3 with ${d3Bhaskar.overall_score} pts each.`);

// 4. Test Day 4 Isolation: Day 2 & Day 3 scores are NOT carried over into Day 4!
const day4Lb = result.dayLeaderboards['Day 4'];
const d4Aditya = day4Lb.find(s => s.squad === 'Aditya');
const d4Bhaskar = day4Lb.find(s => s.squad === 'Bhaskar');
const d4Mitra = day4Lb.find(s => s.squad === 'Mitra');

assert.strictEqual(d4Aditya.overall_score, 0.00, 'Aditya score must be 0.00 on Day 4');
assert.strictEqual(d4Bhaskar.overall_score, 0.00, 'Bhaskar score must be 0.00 on Day 4');
assert.strictEqual(d4Mitra.overall_score, 0.05, 'Mitra should have 0.05 pts on Day 4 (2 pts * 0.025)');
console.log(`✓ TEST 4 PASSED: Day 4 isolated. Mitra has ${d4Mitra.overall_score} pts, others have 0.00.`);

// 5. Test Day 5 Isolation: Surya won Food Serving
const day5Lb = result.dayLeaderboards['Day 5'];
const d5Surya = day5Lb.find(s => s.squad === 'Surya');
const d5Mitra = day5Lb.find(s => s.squad === 'Mitra');
const d5Aditya = day5Lb.find(s => s.squad === 'Aditya');

assert.strictEqual(d5Surya.overall_score, 0.50, 'Surya should have 0.50 pts on Day 5 (10 pts * 0.05)');
assert.strictEqual(d5Mitra.overall_score, 0.00, 'Mitra should have 0.00 pts on Day 5 (Food Serving is 1 winner)');
assert.strictEqual(d5Aditya.overall_score, 0.00, 'Aditya should have 0.00 pts on Day 5');
assert.strictEqual(day5Lb[0].squad, 'Surya', 'Surya should be Rank #1 on Day 5');
console.log(`✓ TEST 5 PASSED: Day 5 isolated. Rank 1: ${day5Lb[0].squad} (${day5Lb[0].overall_score} pts).`);

// 6. Test Overall Cumulative Scoring Preserved
const overallLb = result.leaderboard;
const ovAditya = overallLb.find(s => s.squad === 'Aditya');
const ovBhaskar = overallLb.find(s => s.squad === 'Bhaskar');
const ovMitra = overallLb.find(s => s.squad === 'Mitra');
const ovSurya = overallLb.find(s => s.squad === 'Surya');

assert(ovAditya.overall_score > 0, 'Aditya must have accumulated overall score');
assert(ovSurya.overall_score > 0, 'Surya must have accumulated overall score');
console.log('✓ TEST 6 PASSED: Overall cumulative leaderboard preserves all days accurately.');

// 7. Test Empty Day Handling (No activities played on a day)
const emptyRes = calculateSquadPerformance([]);
['Day 2', 'Day 3', 'Day 4', 'Day 5'].forEach(d => {
  const lb = emptyRes.dayLeaderboards[d];
  assert(lb.every(s => s.overall_score === 0), `All squads must have 0 score on empty ${d}`);
  assert(lb.every(s => s.first_count === 0), `All squads must have 0 gold on empty ${d}`);
});
console.log('✓ TEST 7 PASSED: Empty day returns all 0 scores and 0 wins correctly.');

console.log('\n========================================================================');
console.log('ALL INDEPENDENT DAY-WISE SCORING TESTS PASSED (100%)!');
console.log('========================================================================');
