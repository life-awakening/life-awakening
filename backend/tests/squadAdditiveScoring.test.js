const assert = require('assert');
const squadScoringEngine = require('../services/squadScoringEngine');

console.log('========================================================================');
console.log('RUNNING SQUAD ADDITIVE DAY-WISE SCORING COMPREHENSIVE TEST SUITE');
console.log('========================================================================\n');

// 1. Mock Demographics for Gender-Weighted Fall-In
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

// 2. Mock Selections covering all 4 days with exact scenarios
const selections = [
  // ─── DAY 2 (Punctuality Fall-In: Dinkar=1, Mitra=2, Tejonidhi=3, Bhaskar=4, Aditya=5, Martand=6, Prabhakar=7, Ravi=8, Surya=9, Divakar=10)
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({
      'Dinkar': 1, 'Mitra': 2, 'Tejonidhi': 3, 'Bhaskar': 4, 'Aditya': 5,
      'Martand': 6, 'Prabhakar': 7, 'Ravi': 8, 'Surya': 9, 'Divakar': 10
    }),
    second_squad: JSON.stringify({
      'Dinkar': 1, 'Mitra': 2, 'Tejonidhi': 3, 'Bhaskar': 4, 'Aditya': 5,
      'Martand': 6, 'Prabhakar': 7, 'Ravi': 8, 'Surya': 9, 'Divakar': 10
    })
  },

  // ─── DAY 3 (Punctuality Fall-In: Aditya=1, Bhaskar=2, Dinkar=3, Divakar=4, Martand=5, Prabhakar=6, Mitra=7, Ravi=8, Surya=9, Tejonidhi=10)
  {
    batch_id: 1,
    day: 'Day 3',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({
      'Aditya': 1, 'Bhaskar': 2, 'Dinkar': 3, 'Divakar': 4, 'Martand': 5,
      'Prabhakar': 6, 'Mitra': 7, 'Ravi': 8, 'Surya': 9, 'Tejonidhi': 10
    }),
    second_squad: JSON.stringify({
      'Aditya': 1, 'Bhaskar': 2, 'Dinkar': 3, 'Divakar': 4, 'Martand': 5,
      'Prabhakar': 6, 'Mitra': 7, 'Ravi': 8, 'Surya': 9, 'Tejonidhi': 10
    })
  },
  {
    batch_id: 1,
    day: 'Day 3',
    activity_title: 'Quiz',
    first_squad: 'Mitra,Dinkar' // 5 pts each * 0.05 = 0.25
  },

  // ─── DAY 4 (Punctuality Fall-In: Aditya=1, Bhaskar=2, Dinkar=3, Divakar=4, Martand=5, Prabhakar=6, Mitra=7, Ravi=8, Surya=9, Tejonidhi=10)
  {
    batch_id: 1,
    day: 'Day 4',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({
      'Aditya': 1, 'Bhaskar': 2, 'Dinkar': 3, 'Divakar': 4, 'Martand': 5,
      'Prabhakar': 6, 'Mitra': 7, 'Ravi': 8, 'Surya': 9, 'Tejonidhi': 10
    }),
    second_squad: JSON.stringify({
      'Aditya': 1, 'Bhaskar': 2, 'Dinkar': 3, 'Divakar': 4, 'Martand': 5,
      'Prabhakar': 6, 'Mitra': 7, 'Ravi': 8, 'Surya': 9, 'Tejonidhi': 10
    })
  },
  {
    batch_id: 1,
    day: 'Day 4',
    activity_title: 'Debate',
    first_squad: 'Mitra,Dinkar,Tejonidhi,Bhaskar,Martand' // 2 pts each * 0.025 = 0.05
  },
  {
    batch_id: 1,
    day: 'Day 4',
    activity_title: 'Kho Kho',
    first_squad: 'Mitra,Dinkar,Tejonidhi,Bhaskar,Prabhakar' // 2 pts each * 0.025 = 0.05
  },

  // ─── DAY 5 (Punctuality Fall-In + Obstacle + Standard + Pillars)
  {
    batch_id: 1,
    day: 'Day 5',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({
      'Mitra': 1, 'Dinkar': 2, 'Tejonidhi': 3, 'Bhaskar': 4, 'Aditya': 5,
      'Martand': 6, 'Prabhakar': 7, 'Ravi': 8, 'Surya': 9, 'Divakar': 10
    }),
    second_squad: JSON.stringify({
      'Mitra': 1, 'Dinkar': 2, 'Tejonidhi': 3, 'Bhaskar': 4, 'Aditya': 5,
      'Martand': 6, 'Prabhakar': 7, 'Ravi': 8, 'Surya': 9, 'Divakar': 10
    })
  },
  {
    batch_id: 1,
    day: 'Day 5',
    activity_title: 'Obstacle',
    first_squad: 'Dinkar,Tejonidhi,Divakar,Mitra,Surya,Bhaskar,Ravi,Aditya,Prabhakar,Martand'
    // Rank 1: Dinkar (10 pts * 0.05 = 0.50)
    // Rank 2: Tejonidhi (9 pts * 0.05 = 0.45)
    // Rank 3: Divakar (8 pts * 0.05 = 0.40)
    // Rank 4: Mitra (7 pts * 0.05 = 0.35)
  },
  {
    batch_id: 1,
    day: 'Day 5',
    activity_title: 'Food Serving',
    first_squad: 'Mitra' // 10 pts * 0.05 = 0.50
  },
  {
    batch_id: 1,
    day: 'Day 5',
    activity_title: 'Coordination, Courtesy, Maintain Discipline, Hygiene',
    first_squad: 'Dinkar', // 10 pts * 0.05 = 0.50
    second_squad: 'Mitra', // 9 pts * 0.05 = 0.45
    third_squad: 'Tejonidhi' // 8 pts * 0.05 = 0.40
  },
  {
    batch_id: 1,
    day: 'Day 5',
    activity_title: 'Agriculture',
    first_squad: 'Mitra' // 2 pts * 0.05 = 0.10
  }
];

const result = squadScoringEngine.calculateSquadPerformance(selections, mockDemographics);

console.log('TEST 1: Verification that Day 2 + Day 3 + Day 4 + Day 5 == Overall Score for ALL 10 Squads:');
console.log('---------------------------------------------------------------------------------------------------------------');
console.log(String('Squad').padEnd(12) + ' | ' +
  String('Day 2').padStart(6) + ' | ' +
  String('Day 3').padStart(6) + ' | ' +
  String('Day 4').padStart(6) + ' | ' +
  String('Day 5').padStart(6) + ' | ' +
  String('Sum of Days').padStart(11) + ' | ' +
  String('Overall').padStart(8) + ' | ' +
  String('Difference').padStart(10) + ' | Status');
console.log('---------------------------------------------------------------------------------------------------------------');

let allZeroDiff = true;

squadScoringEngine.SQUAD_CANONICAL_NAMES.forEach(sq => {
  const d2 = result.dayLeaderboards['Day 2'].find(s => s.squad === sq)?.overall_score || 0;
  const d3 = result.dayLeaderboards['Day 3'].find(s => s.squad === sq)?.overall_score || 0;
  const d4 = result.dayLeaderboards['Day 4'].find(s => s.squad === sq)?.overall_score || 0;
  const d5 = result.dayLeaderboards['Day 5'].find(s => s.squad === sq)?.overall_score || 0;

  const sumDays = Number((d2 + d3 + d4 + d5).toFixed(2));
  const overall = result.leaderboard.find(s => s.squad === sq)?.overall_score || 0;
  const diff = Number(Math.abs(sumDays - overall).toFixed(2));

  if (diff > 0.001) allZeroDiff = false;

  console.log(
    sq.padEnd(12) + ' | ' +
    d2.toFixed(2).padStart(6) + ' | ' +
    d3.toFixed(2).padStart(6) + ' | ' +
    d4.toFixed(2).padStart(6) + ' | ' +
    d5.toFixed(2).padStart(6) + ' | ' +
    sumDays.toFixed(2).padStart(11) + ' | ' +
    overall.toFixed(2).padStart(8) + ' | ' +
    diff.toFixed(2).padStart(10) + ' | ' +
    (diff === 0 ? '✓ EXACT MATCH' : '✗ MISMATCH')
  );

  assert.strictEqual(diff, 0, `Squad ${sq} must satisfy Day 2 + Day 3 + Day 4 + Day 5 == Overall Score`);
});

console.log('---------------------------------------------------------------------------------------------------------------');
assert.ok(allZeroDiff, 'All 10 squads must have exactly 0.00 difference!');
console.log('✓ TEST 1 PASSED: Zero difference across all 10 squads!\n');

// TEST 2: Mitra specific calculations
const mitraOverall = result.leaderboard.find(s => s.squad === 'Mitra');
const mitraD2 = result.dayLeaderboards['Day 2'].find(s => s.squad === 'Mitra');
const mitraD3 = result.dayLeaderboards['Day 3'].find(s => s.squad === 'Mitra');
const mitraD4 = result.dayLeaderboards['Day 4'].find(s => s.squad === 'Mitra');
const mitraD5 = result.dayLeaderboards['Day 5'].find(s => s.squad === 'Mitra');

console.log('TEST 2: Mitra Detailed Contribution Breakdown:');
console.log(`  • Day 2 Score: ${mitraD2.overall_score.toFixed(2)} (Rank 2 Punctuality: 9 x 0.10 = 0.90)`);
console.log(`  • Day 3 Score: ${mitraD3.overall_score.toFixed(2)} (Punctuality + Quiz: (4 x 0.10) + (5 x 0.05) = 0.65)`);
console.log(`  • Day 4 Score: ${mitraD4.overall_score.toFixed(2)} (Punctuality + Debate + Kho Kho: (4 x 0.10) + 0.05 + 0.05 = 0.50)`);
console.log(`  • Day 5 Score: ${mitraD5.overall_score.toFixed(2)} (Punctuality + Obstacle + Food + Coord + Agri)`);
console.log(`  • Final Overall Score: ${mitraOverall.overall_score.toFixed(2)}`);

assert.strictEqual(mitraD2.overall_score, 0.90, 'Mitra Day 2 must be 0.90');
assert.strictEqual(mitraD3.overall_score, 0.65, 'Mitra Day 3 must be 0.65');
assert.strictEqual(mitraD4.overall_score, 0.50, 'Mitra Day 4 must be 0.50');
assert.strictEqual(
  Number((mitraD2.overall_score + mitraD3.overall_score + mitraD4.overall_score + mitraD5.overall_score).toFixed(2)),
  mitraOverall.overall_score,
  'Mitra sum of days must equal overall score'
);
console.log('✓ TEST 2 PASSED: Mitra scores match exact theoretical values!\n');

console.log('========================================================================');
console.log('ALL ADDITIVE SCORING UNIT TESTS PASSED SUCCESSFULLY!');
console.log('========================================================================');
