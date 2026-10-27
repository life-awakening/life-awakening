const assert = require('assert');
const {
  calculateSquadPerformance,
  generateSquadPerformanceExcelBuffer,
  parseFallInPositions,
  SQUAD_CANONICAL_NAMES
} = require('../services/squadScoringEngine');

console.log('================================================================');
console.log('RUNNING COMPREHENSIVE FALL-IN FINAL BUSINESS RULE VALIDATION TESTS');
console.log('================================================================\n');

// Mock demographics
const mockDemographics = {
  totalBoys: 254,
  totalGirls: 87,
  squads: {
    'Aditya': { boys: 30, girls: 8 },
    'Bhaskar': { boys: 25, girls: 9 },
    'Dinkar': { boys: 28, girls: 10 },
    'Divakar': { boys: 26, girls: 7 },
    'Martand': { boys: 24, girls: 9 },
    'Mitra': { boys: 22, girls: 11 },
    'Prabhakar': { boys: 27, girls: 8 },
    'Ravi': { boys: 23, girls: 9 },
    'Surya': { boys: 25, girls: 8 },
    'Tejonidhi': { boys: 24, girls: 8 }
  }
};

// TEST A: Boys: Aditya=1, Bhaskar=1, Dinkar=2, Divakar=2, Mitra=3, Others blank
console.log('TEST A: Boys: Aditya=1, Bhaskar=1, Dinkar=2, Divakar=2, Mitra=3, Others blank...');
{
  const boysPositions = {
    'Aditya': 1,
    'Bhaskar': 1,
    'Dinkar': 2,
    'Divakar': 2,
    'Mitra': 3
  };
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify(boysPositions),
    second_squad: null
  }];
  const res = calculateSquadPerformance(selections, mockDemographics);

  // Check Aditya: 30/38 * 10 = 7.8947, Rank 1 -> 1 Gold
  const aditya = res.leaderboard.find(s => s.squad === 'Aditya');
  const expAditya = Number(((30 / 38) * 10).toFixed(4));
  assert.strictEqual(aditya.punc_fall_in_points, expAditya, 'Aditya points match pos 1 (x10)');
  assert.strictEqual(aditya.first_count, 1, 'Aditya awarded Gold (1st overall in Fall-In)');

  // Check Bhaskar: 25/34 * 10 = 7.3529, Rank 2 -> 1 Silver
  const bhaskar = res.leaderboard.find(s => s.squad === 'Bhaskar');
  const expBhaskar = Number(((25 / 34) * 10).toFixed(4));
  assert.strictEqual(bhaskar.punc_fall_in_points, expBhaskar, 'Bhaskar points match pos 1 (x10)');
  assert.strictEqual(bhaskar.second_count, 1, 'Bhaskar awarded Silver (2nd overall in Fall-In)');

  // Check Divakar: 26/33 * 9 = 7.0909, Rank 3 -> 1 Bronze
  const divakar = res.leaderboard.find(s => s.squad === 'Divakar');
  const expDivakar = Number(((26 / 33) * 9).toFixed(4));
  assert.strictEqual(divakar.punc_fall_in_points, expDivakar, 'Divakar points match pos 2 (x9)');
  assert.strictEqual(divakar.third_count, 1, 'Divakar awarded Bronze (3rd overall in Fall-In)');

  // Check Dinkar: 28/38 * 9 = 6.6316, Rank 4 -> No medal
  const dinkar = res.leaderboard.find(s => s.squad === 'Dinkar');
  const expDinkar = Number(((28 / 38) * 9).toFixed(4));
  assert.strictEqual(dinkar.punc_fall_in_points, expDinkar, 'Dinkar points match pos 2 (x9)');
  assert.strictEqual(dinkar.first_count + dinkar.second_count + dinkar.third_count, 0, 'Dinkar Rank 4 no medal');

  // Check Mitra: 22/33 * 8 = 5.3333, Rank 5 -> No medal
  const mitra = res.leaderboard.find(s => s.squad === 'Mitra');
  const expMitra = Number(((22 / 33) * 8).toFixed(4));
  assert.strictEqual(mitra.punc_fall_in_points, expMitra, 'Mitra points match pos 3 (x8)');
  assert.strictEqual(mitra.first_count + mitra.second_count + mitra.third_count, 0, 'Mitra Rank 5 no medal');

  // Check unselected squad (e.g. Martand)
  const martand = res.leaderboard.find(s => s.squad === 'Martand');
  assert.strictEqual(martand.punc_fall_in_points, 0, 'Unselected squad receives 0 points');
  assert.strictEqual(martand.first_count + martand.second_count + martand.third_count, 0, 'Unselected squad receives no medals');

  console.log('  ✓ TEST A PASSED: Squads ranked by Fall-In Total score and awarded medals correctly.');
}

// TEST B: Girls: Aditya=1, Bhaskar=1, Dinkar=2, Divakar=2, Mitra=3, Others blank
console.log('\nTEST B: Girls: Aditya=1, Bhaskar=1, Dinkar=2, Divakar=2, Mitra=3, Others blank...');
{
  const girlsPositions = {
    'Aditya': 1,
    'Bhaskar': 1,
    'Dinkar': 2,
    'Divakar': 2,
    'Mitra': 3
  };
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: null,
    second_squad: JSON.stringify(girlsPositions)
  }];
  const res = calculateSquadPerformance(selections, mockDemographics);

  // Check Mitra: 11/33 * 8 = 2.6667, Rank 1 -> 1 Gold
  const mitra = res.leaderboard.find(s => s.squad === 'Mitra');
  const expMitra = Number(((11 / 33) * 8).toFixed(4));
  assert.strictEqual(mitra.punc_fall_in_points, expMitra);
  assert.strictEqual(mitra.first_count, 1);

  // Check Bhaskar: 9/34 * 10 = 2.6471, Rank 2 -> 1 Silver
  const bhaskar = res.leaderboard.find(s => s.squad === 'Bhaskar');
  const expBhaskar = Number(((9 / 34) * 10).toFixed(4));
  assert.strictEqual(bhaskar.punc_fall_in_points, expBhaskar);
  assert.strictEqual(bhaskar.second_count, 1);

  // Check Dinkar: 10/38 * 9 = 2.3684, Rank 3 -> 1 Bronze
  const dinkar = res.leaderboard.find(s => s.squad === 'Dinkar');
  const expDinkar = Number(((10 / 38) * 9).toFixed(4));
  assert.strictEqual(dinkar.punc_fall_in_points, expDinkar);
  assert.strictEqual(dinkar.third_count, 1);

  // Check Aditya: 8/38 * 10 = 2.1053, Rank 4 -> No medal
  const aditya = res.leaderboard.find(s => s.squad === 'Aditya');
  const expAditya = Number(((8 / 38) * 10).toFixed(4));
  assert.strictEqual(aditya.punc_fall_in_points, expAditya);
  assert.strictEqual(aditya.first_count + aditya.second_count + aditya.third_count, 0);

  console.log('  ✓ TEST B PASSED: Girls independent selections calculated and awarded medals correctly.');
}

// TEST C: All 10 squads = 1
console.log('\nTEST C: All 10 squads = 1 (Multipliers applied)...');
{
  const all10Boys = {};
  SQUAD_CANONICAL_NAMES.forEach(sq => { all10Boys[sq] = 1; });

  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify(all10Boys),
    second_squad: null
  }];
  const res = calculateSquadPerformance(selections, mockDemographics);

  assert.strictEqual(res.leaderboard.length, 10);
  res.leaderboard.forEach(item => {
    const sqBoys = mockDemographics.squads[item.squad].boys;
    const sqGirls = mockDemographics.squads[item.squad].girls;
    const expPts = Number(((sqBoys / (sqBoys + sqGirls)) * 10).toFixed(4));
    assert.strictEqual(item.punc_fall_in_points, expPts, `${item.squad} receives x10 multiplier`);
  });
  // Top 3 squads by boys percentage get Gold, Silver, Bronze:
  assert.strictEqual(res.leaderboard[0].first_count, 1, 'Top 1 gets Gold');
  assert.strictEqual(res.leaderboard[1].second_count, 1, 'Top 2 gets Silver');
  assert.strictEqual(res.leaderboard[2].third_count, 1, 'Top 3 gets Bronze');
  console.log('  ✓ TEST C PASSED: All 10 squads at position 1 successfully calculated.');
}

// TEST D: All dropdowns blank
console.log('\nTEST D: All dropdowns blank...');
{
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify({}),
    second_squad: JSON.stringify({})
  }];
  const res = calculateSquadPerformance(selections, mockDemographics);

  assert.strictEqual(res.leaderboard.length, 10);
  res.leaderboard.forEach(item => {
    assert.strictEqual(item.punc_fall_in_points, 0, `${item.squad} has 0 points`);
    assert.strictEqual(item.first_count + item.second_count + item.third_count, 0, `${item.squad} has 0 medals`);
  });
  console.log('  ✓ TEST D PASSED: Empty Fall-In selections evaluated without errors.');
}

// TEST E: Random partial positions: Aditya=1, Bhaskar=1, Dinkar=4, Ravi=7, Tejonidhi=10
console.log('\nTEST E: Random partial positions: Aditya=1, Bhaskar=1, Dinkar=4, Ravi=7, Tejonidhi=10...');
{
  const partialBoys = {
    'Aditya': 1,
    'Bhaskar': 1,
    'Dinkar': 4,
    'Ravi': 7,
    'Tejonidhi': 10
  };
  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify(partialBoys),
    second_squad: null
  }];
  const res = calculateSquadPerformance(selections, mockDemographics);

  // Aditya = 1 -> Rank 1 (7.8947), Gold
  const aditya = res.leaderboard.find(s => s.squad === 'Aditya');
  assert.strictEqual(aditya.punc_fall_in_points, Number(((30 / 38) * 10).toFixed(4)));
  assert.strictEqual(aditya.first_count, 1);

  // Bhaskar = 1 -> Rank 2 (7.3529), Silver
  const bhaskar = res.leaderboard.find(s => s.squad === 'Bhaskar');
  assert.strictEqual(bhaskar.punc_fall_in_points, Number(((25 / 34) * 10).toFixed(4)));
  assert.strictEqual(bhaskar.second_count, 1);

  // Dinkar = 4 -> Rank 3 (5.1579), Bronze
  const dinkar = res.leaderboard.find(s => s.squad === 'Dinkar');
  assert.strictEqual(dinkar.punc_fall_in_points, Number(((28 / 38) * 7).toFixed(4)));
  assert.strictEqual(dinkar.third_count, 1, 'Rank 3 gets Bronze');

  // Ravi = 7 -> Rank 4 (2.875), No medal
  const ravi = res.leaderboard.find(s => s.squad === 'Ravi');
  assert.strictEqual(ravi.punc_fall_in_points, Number(((23 / 32) * 4).toFixed(4)));
  assert.strictEqual(ravi.first_count + ravi.second_count + ravi.third_count, 0, 'Rank 4 gets no medal');

  // Tejonidhi = 10 -> Rank 5 (0.75), No medal
  const tejo = res.leaderboard.find(s => s.squad === 'Tejonidhi');
  assert.strictEqual(tejo.punc_fall_in_points, Number(((24 / 32) * 1).toFixed(4)));
  assert.strictEqual(tejo.first_count + tejo.second_count + tejo.third_count, 0, 'Rank 5 gets no medal');

  console.log('  ✓ TEST E PASSED: Partial positions and activity-level medal rankings evaluated correctly.');
}

// TEST F: Same squad selected in Boys and Girls with different positions
console.log('\nTEST F: Same squad in Boys & Girls with different positions (Bhaskar: Boys=1, Girls=3; Aditya: Boys=1, Girls=1)...');
{
  const boys = { 'Bhaskar': 1, 'Aditya': 1 };
  const girls = { 'Bhaskar': 3, 'Aditya': 1 };

  const selections = [{
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Punctuality - Fall In',
    first_squad: JSON.stringify(boys),
    second_squad: JSON.stringify(girls)
  }];
  const res = calculateSquadPerformance(selections, mockDemographics);

  // Bhaskar: Boys 1 (x10) + Girls 3 (x8) -> 25/34 * 10 + 9/34 * 8 = 9.4706, Rank 2 -> 1 Silver
  const bhaskar = res.leaderboard.find(s => s.squad === 'Bhaskar');
  const expBhaskar = Number((((25 / 34) * 10) + ((9 / 34) * 8)).toFixed(4));
  assert.strictEqual(bhaskar.punc_fall_in_points, expBhaskar);
  assert.strictEqual(bhaskar.second_count, 1, 'Bhaskar has 1 Silver (Rank 2)');

  // Aditya: Boys 1 (x10) + Girls 1 (x10) -> 30/38 * 10 + 8/38 * 10 = 10.00, Rank 1 -> 1 Gold
  const aditya = res.leaderboard.find(s => s.squad === 'Aditya');
  const expAditya = Number((((30 / 38) * 10) + ((8 / 38) * 10)).toFixed(4));
  assert.strictEqual(aditya.punc_fall_in_points, expAditya);
  assert.strictEqual(aditya.first_count, 1, 'Aditya has 1 Gold (Rank 1)');

  console.log('  ✓ TEST F PASSED: Boys and Girls are combined and squads ranked by Fall-In Total score.');
}

// Multi-Day Accumulation & Excel generation test
console.log('\nTEST G: Multi-Day Fall-In Accumulation across Day 2, Day 3, Day 4, Day 5 + Excel Generation...');
{
  const selections = [
    {
      batch_id: 1,
      day: 'Day 2',
      activity_title: 'Punctuality - Fall In',
      first_squad: JSON.stringify({ 'Aditya': 1, 'Bhaskar': 1 }),
      second_squad: JSON.stringify({ 'Aditya': 1 })
    },
    {
      batch_id: 1,
      day: 'Day 3',
      activity_title: 'Punctuality - Fall In',
      first_squad: JSON.stringify({ 'Bhaskar': 2, 'Dinkar': 2 }),
      second_squad: JSON.stringify({ 'Bhaskar': 1 })
    },
    {
      batch_id: 1,
      day: 'Day 4',
      activity_title: 'Punctuality - Fall In',
      first_squad: JSON.stringify({ 'Aditya': 3, 'Tejonidhi': 10 }),
      second_squad: null
    },
    {
      batch_id: 1,
      day: 'Day 5',
      activity_title: 'Punctuality - Fall In',
      first_squad: JSON.stringify({ 'Aditya': 1 }),
      second_squad: JSON.stringify({ 'Bhaskar': 2 })
    }
  ];

  const res = calculateSquadPerformance(selections, mockDemographics);
  const aditya = res.leaderboard.find(s => s.squad === 'Aditya');
  const bhaskar = res.leaderboard.find(s => s.squad === 'Bhaskar');

  assert.ok(aditya.punc_fall_in_points > 0);
  assert.ok(bhaskar.punc_fall_in_points > 0);
  assert.strictEqual(aditya.dayStats['Day 2'].gold, 1, 'Aditya Day 2 Gold count = 1');
  assert.strictEqual(aditya.dayStats['Day 5'].gold, 1, 'Aditya Day 5 Gold count = 1');

  // Excel buffer check
  const excelBuffer = generateSquadPerformanceExcelBuffer({ name: 'Batch 1', year: 2026 }, res);
  assert.ok(excelBuffer && excelBuffer.length > 0, 'Excel workbook generated successfully');
  console.log('  ✓ TEST G PASSED: Multi-day accumulation and Excel generation verified.');
}

console.log('\n================================================================');
console.log('ALL REQUIRED TESTS (A through G) COMPLETED WITH 100% PASS RATE!');
console.log('================================================================\n');
