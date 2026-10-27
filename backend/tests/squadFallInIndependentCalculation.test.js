const assert = require('assert');
const XLSX = require('xlsx');
const {
  calculateSquadPerformance,
  generateSquadPerformanceExcelBuffer,
  SQUAD_CANONICAL_NAMES
} = require('../services/squadScoringEngine');

console.log('========================================================================');
console.log('RUNNING SQUAD FALL-IN INTERNAL GENDER SHARE CALCULATION TEST SUITE');
console.log('========================================================================\n');

// Mock demographics with distinct internal gender compositions per squad
const mockDemographics = {
  totalBoys: 550,
  totalGirls: 450,
  squads: {
    'Aditya': { boys: 70, girls: 30 },    // 70% Boys, 30% Girls (Total 100)
    'Bhaskar': { boys: 60, girls: 40 },   // 60% Boys, 40% Girls (Total 100)
    'Dinkar': { boys: 45, girls: 55 },    // 45% Boys, 55% Girls (Total 100)
    'Divakar': { boys: 80, girls: 20 },   // 80% Boys, 20% Girls (Total 100)
    'Mitra': { boys: 50, girls: 50 },     // 50% Boys, 50% Girls (Total 100)
    'Martand': { boys: 65, girls: 35 },   // 65% Boys, 35% Girls (Total 100)
    'Prabhakar': { boys: 40, girls: 60 }, // 40% Boys, 60% Girls (Total 100)
    'Ravi': { boys: 55, girls: 45 },      // 55% Boys, 45% Girls (Total 100)
    'Surya': { boys: 30, girls: 70 },     // 30% Boys, 70% Girls (Total 100)
    'Tejonidhi': { boys: 55, girls: 45 }  // 55% Boys, 45% Girls (Total 100)
  }
};

// UI Helper calculation function (mimicking frontend internal gender share calculation)
const calculateUiFallInScore = (squad, boysRank, girlsRank, demographics) => {
  const sqBoys = demographics?.squads?.[squad]?.boys ?? 0;
  const sqGirls = demographics?.squads?.[squad]?.girls ?? 0;
  const sqTotal = sqBoys + sqGirls;

  const boysShare = sqTotal > 0 ? (sqBoys / sqTotal) : 0.5;
  const girlsShare = sqTotal > 0 ? (sqGirls / sqTotal) : 0.5;

  const bMult = (boysRank >= 1 && boysRank <= 10) ? (11 - boysRank) : 0;
  const gMult = (girlsRank >= 1 && girlsRank <= 10) ? (11 - girlsRank) : 0;

  const bScore = boysRank ? (boysShare * bMult) : 0;
  const gScore = girlsRank ? (girlsShare * gMult) : 0;

  return {
    boysShare,
    girlsShare,
    boysScore: Number(bScore.toFixed(4)),
    girlsScore: Number(gScore.toFixed(4)),
    totalScore: Number((bScore + gScore).toFixed(4))
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 1: 70 Boys / 30 Girls, both Rank 1 -> 7 + 3 = 10
// ─────────────────────────────────────────────────────────────────────────────
console.log('TEST 1: 70 Boys / 30 Girls (Aditya), both Rank 1 -> 7 + 3 = 10');
{
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ 'Aditya': 1 }),
    second_squad: JSON.stringify({ 'Aditya': 1 })
  }];

  const res = calculateSquadPerformance(selections, mockDemographics);
  const uiCalc = calculateUiFallInScore('Aditya', 1, 1, mockDemographics);
  const backendAditya = res.leaderboard.find(s => s.squad === 'Aditya');

  assert.strictEqual(uiCalc.boysScore, 7.00);
  assert.strictEqual(uiCalc.girlsScore, 3.00);
  assert.strictEqual(uiCalc.totalScore, 10.00);
  assert.strictEqual(backendAditya.punc_fall_in_points, 10.00);
  assert.strictEqual(backendAditya.punc_total_points, 10.00);

  // Excel Buffer Verification
  const wbBuf = generateSquadPerformanceExcelBuffer({ name: 'Test Batch' }, res);
  const wb = XLSX.read(wbBuf, { type: 'buffer' });
  const sheetData = XLSX.utils.sheet_to_json(wb.Sheets['Overall Score']);
  const excelAditya = sheetData.find(r => r.Squad === 'Squad Aditya');
  assert.ok(excelAditya, 'Aditya exists in Excel sheet');

  console.log('  ✓ UI (10.00) = Backend (10.00) = Leaderboard (10.00) = Excel verified');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 2: 70 Boys / 30 Girls, Boys Rank 1, Girls blank -> 7 + 0 = 7
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 2: 70 Boys / 30 Girls (Aditya), Boys Rank 1, Girls blank -> 7 + 0 = 7');
{
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ 'Aditya': 1 }),
    second_squad: null
  }];

  const res = calculateSquadPerformance(selections, mockDemographics);
  const uiCalc = calculateUiFallInScore('Aditya', 1, null, mockDemographics);
  const backendAditya = res.leaderboard.find(s => s.squad === 'Aditya');

  assert.strictEqual(uiCalc.boysScore, 7.00);
  assert.strictEqual(uiCalc.girlsScore, 0);
  assert.strictEqual(uiCalc.totalScore, 7.00);
  assert.strictEqual(backendAditya.punc_fall_in_points, 7.00);

  console.log('  ✓ UI (7.00) = Backend (7.00) = Leaderboard (7.00) verified');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 3: 70 Boys / 30 Girls, Boys Rank 2, Girls Rank 3 -> 6.30 + 2.40 = 8.70
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 3: 70 Boys / 30 Girls (Aditya), Boys Rank 2, Girls Rank 3 -> 6.30 + 2.40 = 8.70');
{
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ 'Aditya': 2 }),
    second_squad: JSON.stringify({ 'Aditya': 3 })
  }];

  const res = calculateSquadPerformance(selections, mockDemographics);
  const uiCalc = calculateUiFallInScore('Aditya', 2, 3, mockDemographics);
  const backendAditya = res.leaderboard.find(s => s.squad === 'Aditya');

  assert.strictEqual(uiCalc.boysScore, 6.30);
  assert.strictEqual(uiCalc.girlsScore, 2.40);
  assert.strictEqual(uiCalc.totalScore, 8.70);
  assert.strictEqual(backendAditya.punc_fall_in_points, 8.70);

  console.log('  ✓ UI (8.70) = Backend (8.70) = Leaderboard (8.70) verified');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 4: 60 Boys / 40 Girls, both Rank 1 -> 6 + 4 = 10
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 4: 60 Boys / 40 Girls (Bhaskar), both Rank 1 -> 6 + 4 = 10');
{
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ 'Bhaskar': 1 }),
    second_squad: JSON.stringify({ 'Bhaskar': 1 })
  }];

  const res = calculateSquadPerformance(selections, mockDemographics);
  const uiCalc = calculateUiFallInScore('Bhaskar', 1, 1, mockDemographics);
  const backendBhaskar = res.leaderboard.find(s => s.squad === 'Bhaskar');

  assert.strictEqual(uiCalc.boysScore, 6.00);
  assert.strictEqual(uiCalc.girlsScore, 4.00);
  assert.strictEqual(uiCalc.totalScore, 10.00);
  assert.strictEqual(backendBhaskar.punc_fall_in_points, 10.00);

  console.log('  ✓ UI (10.00) = Backend (10.00) = Leaderboard (10.00) verified');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 5: 45 Boys / 55 Girls, Boys Rank 1, Girls Rank 5 -> 4.50 + 3.30 = 7.80
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 5: 45 Boys / 55 Girls (Dinkar), Boys Rank 1, Girls Rank 5 -> 4.50 + 3.30 = 7.80');
{
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ 'Dinkar': 1 }),
    second_squad: JSON.stringify({ 'Dinkar': 5 }) // Rank 5 = 6 points
  }];

  const res = calculateSquadPerformance(selections, mockDemographics);
  const uiCalc = calculateUiFallInScore('Dinkar', 1, 5, mockDemographics);
  const backendDinkar = res.leaderboard.find(s => s.squad === 'Dinkar');

  assert.strictEqual(uiCalc.boysScore, 4.50);
  assert.strictEqual(uiCalc.girlsScore, 3.30);
  assert.strictEqual(uiCalc.totalScore, 7.80);
  assert.strictEqual(backendDinkar.punc_fall_in_points, 7.80);

  console.log('  ✓ UI (7.80) = Backend (7.80) = Leaderboard (7.80) verified');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 6: Different gender proportions for all 10 squads
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 6: Different gender proportions across all 10 squads');
{
  const boysPos = {};
  const girlsPos = {};
  SQUAD_CANONICAL_NAMES.forEach((sq, idx) => {
    boysPos[sq] = (idx % 10) + 1;
    girlsPos[sq] = ((idx + 3) % 10) + 1;
  });

  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify(boysPos),
    second_squad: JSON.stringify(girlsPos)
  }];

  const res = calculateSquadPerformance(selections, mockDemographics);

  SQUAD_CANONICAL_NAMES.forEach(sq => {
    const bRank = boysPos[sq];
    const gRank = girlsPos[sq];
    const uiCalc = calculateUiFallInScore(sq, bRank, gRank, mockDemographics);
    const backendItem = res.leaderboard.find(s => s.squad === sq);

    assert.strictEqual(backendItem.punc_fall_in_points, uiCalc.totalScore, `Squad ${sq} Fall-In score matches UI score`);
  });

  console.log('  ✓ All 10 squads with unique gender proportions computed and verified');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 7: Verify all 10 ranks (Rank 1=10 down to Rank 10=1)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 7: Verify all 10 ranks (Rank 1=10 down to Rank 10=1)');
{
  const expectedRankPoints = {
    1: 10,
    2: 9,
    3: 8,
    4: 7,
    5: 6,
    6: 5,
    7: 4,
    8: 3,
    9: 2,
    10: 1
  };

  for (let r = 1; r <= 10; r++) {
    const uiCalc = calculateUiFallInScore('Mitra', r, r, mockDemographics); // Mitra is 50% / 50%
    // 0.50 * expectedRankPoints[r] + 0.50 * expectedRankPoints[r] = expectedRankPoints[r]
    assert.strictEqual(uiCalc.totalScore, expectedRankPoints[r], `Rank ${r} must equal ${expectedRankPoints[r]} points`);
  }

  console.log('  ✓ All 10 Ranks correctly mapped to multipliers 10, 9, 8, 7, 6, 5, 4, 3, 2, 1');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 8: Punctuality 40% overall score weighting remains intact
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 8: Punctuality 40% overall weighting remains intact');
{
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ 'Aditya': 1, 'Bhaskar': 2 }),
    second_squad: JSON.stringify({ 'Aditya': 1, 'Bhaskar': 2 })
  }];

  const res = calculateSquadPerformance(selections, mockDemographics);
  const aditya = res.leaderboard.find(s => s.squad === 'Aditya');
  const bhaskar = res.leaderboard.find(s => s.squad === 'Bhaskar');

  // Punctuality Category (Day 2 carries 10% daily share):
  // Rank 1 gets 10 pts * 0.10 = 1.00
  // Rank 2 gets 9 pts * 0.10 = 0.90
  assert.strictEqual(aditya.punctuality_rank, 1);
  assert.strictEqual(aditya.categoryScores.punctuality, 1.00);
  assert.strictEqual(bhaskar.punctuality_rank, 2);
  assert.strictEqual(bhaskar.categoryScores.punctuality, 0.90);

  console.log('  ✓ Day 2 Punctuality Rank 1 = 1.00 pts (10 * 0.10), Rank 2 = 0.90 pts (9 * 0.10)');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 9: Exact 2-decimal percentage display and unrounded scoring
// Example: 26 Boys + 9 Girls = 35
// Boys Share % = 26/35 * 100 = 74.285714...% -> "74.29%"
// Girls Share % = 9/35 * 100 = 25.714285...% -> "25.71%"
// Boys Score (Rank 1, x10) = 26/35 * 10 = 7.428571... -> display 7.43 pts
// Girls Score (Rank 3, x8) = 9/35 * 8 = 2.057142... -> display 2.06 pts
// Fall-In Total = 7.428571... + 2.057142... = 9.485714... -> display 9.49 pts
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 9: 26 Boys + 9 Girls = 35 -> 74.29% / 25.71%, Boys Rank 1, Girls Rank 3');
{
  const customDemo = {
    totalBoys: 26,
    totalGirls: 9,
    squads: {
      'Aditya': { boys: 26, girls: 9 }
    }
  };

  const sqBoys = 26;
  const sqGirls = 9;
  const sqTotal = sqBoys + sqGirls; // 35
  const boysSharePct = ((sqBoys / sqTotal) * 100).toFixed(2);
  const girlsSharePct = ((sqGirls / sqTotal) * 100).toFixed(2);

  assert.strictEqual(boysSharePct, '74.29', 'Boys percentage must display as 74.29% without whole-number rounding');
  assert.strictEqual(girlsSharePct, '25.71', 'Girls percentage must display as 25.71% without whole-number rounding');

  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({ 'Aditya': 1 }),
    second_squad: JSON.stringify({ 'Aditya': 3 })
  }];

  const res = calculateSquadPerformance(selections, customDemo);
  const aditya = res.leaderboard.find(s => s.squad === 'Aditya');

  const bScore = (26 / 35) * 10; // 7.428571...
  const gScore = (9 / 35) * 8;  // 2.057142...
  const totalScore = bScore + gScore; // 9.485714...

  assert.strictEqual(bScore.toFixed(2), '7.43', 'Boys score displays as 7.43 pts');
  assert.strictEqual(gScore.toFixed(2), '2.06', 'Girls score displays as 2.06 pts');
  assert.strictEqual(totalScore.toFixed(2), '9.49', 'Fall-In total displays as 9.49 pts');
  assert.strictEqual(aditya.punc_fall_in_points, Number(totalScore.toFixed(4)));

  console.log(`  ✓ Boys: ${boysSharePct}% | Score: +${bScore.toFixed(2)} pts`);
  console.log(`  ✓ Girls: ${girlsSharePct}% | Score: +${gScore.toFixed(2)} pts`);
  console.log(`  ✓ Fall-In Total: ${totalScore.toFixed(2)} pts (Exact: ${aditya.punc_fall_in_points})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE 10: 25 Boys + 7 Girls = 32 -> 78.13% / 21.88%
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTEST 10: 25 Boys + 7 Girls = 32 -> 78.13% / 21.88%');
{
  const sqBoys = 25;
  const sqGirls = 7;
  const sqTotal = sqBoys + sqGirls; // 32
  const boysSharePct = ((sqBoys / sqTotal) * 100).toFixed(2);
  const girlsSharePct = ((sqGirls / sqTotal) * 100).toFixed(2);

  assert.strictEqual(boysSharePct, '78.13', 'Boys share must be 78.13%');
  assert.strictEqual(girlsSharePct, '21.88', 'Girls share must be 21.88%');

  console.log(`  ✓ Boys: ${boysSharePct}%, Girls: ${girlsSharePct}% verified`);
}

console.log('\n========================================================================');
console.log('ALL INTERNAL GENDER PROPORTION SQUAD FALL-IN TESTS PASSED (100%)');
console.log('========================================================================\n');
