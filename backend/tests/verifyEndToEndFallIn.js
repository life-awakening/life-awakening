const pool = require('../config/db');
const { calculateSquadPerformance, generateSquadPerformanceExcelBuffer, SQUAD_CANONICAL_NAMES } = require('../services/squadScoringEngine');
const { getBatchGenderDemographics } = require('../controllers/superadminController');

async function runEndToEndVerification() {
  console.log('===============================================================');
  console.log('STARTING END-TO-END SQUAD PERFORMANCE VERIFICATION');
  console.log('===============================================================');

  // 1. Fetch Target Batch
  const batchRes = await pool.query(`
    SELECT id, name, status, year FROM batches 
    WHERE is_deleted IS NOT TRUE 
    ORDER BY CASE WHEN LOWER(status) IN ('active', 'immersion') THEN 0 ELSE 1 END, id DESC 
    LIMIT 1
  `);
  
  if (batchRes.rows.length === 0) {
    console.log('No batches found in database.');
    return;
  }
  
  const batch = batchRes.rows[0];
  console.log(`Target Batch: ID ${batch.id} (${batch.name}), status: ${batch.status}, year: ${batch.year}`);

  // 2. Query demographics using authoritative function
  const demographics = await getBatchGenderDemographics(batch.id);
  console.log('\n--- LIVE BATCH DEMOGRAPHICS (EXCLUDING DNR) ---');
  console.log(`Total Eligible Present Boys: ${demographics.totalBoys}`);
  console.log(`Total Eligible Present Girls: ${demographics.totalGirls}`);
  console.log('\nSquad breakdown:');
  Object.keys(demographics.squads).forEach(sq => {
    console.log(`  Squad ${sq.padEnd(12)}: Boys=${demographics.squads[sq].boys}, Girls=${demographics.squads[sq].girls}`);
  });

  // 3. Query existing activity selections from DB
  const selRes = await pool.query(`
    SELECT day, activity_title, first_squad, second_squad, third_squad, is_locked, selected_at
    FROM squad_performance_selections
    WHERE batch_id = $1
    ORDER BY day, activity_title
  `, [batch.id]);

  console.log(`\nCurrent DB activity selections count: ${selRes.rows.length}`);
  selRes.rows.forEach(s => {
    console.log(`  [${s.day}] ${s.activity_title}: 1st/Boys="${s.first_squad}", 2nd/Girls="${s.second_squad}", 3rd="${s.third_squad}", Locked=${s.is_locked}`);
  });

  // 4. Run authoritative scoring engine with live batch data
  console.log('\n--- LIVE SCORING ENGINE CALCULATION ---');
  const liveResult = calculateSquadPerformance(selRes.rows, demographics);
  const bestSquad = liveResult.leaderboard[0];
  const puncRank1 = [...liveResult.leaderboard].sort((a, b) => (a.punctuality_rank || 99) - (b.punctuality_rank || 99))[0];

  console.log(`Best Squad (Overall Rank #1): Squad ${bestSquad?.squad} (Overall Score: ${bestSquad?.overall_score})`);
  console.log(`Best Captain (Punctuality Rank #1): Squad ${puncRank1?.squad} (Punc Rank: #${puncRank1?.punctuality_rank}, Weighted Punc Score: ${puncRank1?.categoryScores?.punctuality})`);

  console.log('\n--- LIVE LEADERBOARD STANDINGS ---');
  liveResult.leaderboard.forEach(l => {
    console.log(`Rank #${l.rank}: Squad ${l.squad.padEnd(12)} | Overall: ${l.overall_score.toFixed(2)} | Punc: Rank #${l.punctuality_rank} (${l.categoryScores?.punctuality?.toFixed(2)} pts) | Fall-In Pts: ${(l.punc_fall_in_points || 0).toFixed(2)} | Medals: 🥇${l.first_count} 🥈${l.second_count} 🥉${l.third_count}`);
  });

  // 5. Test Excel Generation
  console.log('\n--- EXCEL BUFFER GENERATION ---');
  const excelBuf = generateSquadPerformanceExcelBuffer({ name: batch.name, year: batch.year || 2026 }, liveResult);
  console.log(`✓ Excel buffer successfully generated: ${excelBuf.length} bytes`);

  // 6. Test Controlled Scenario: Exact Position Multipliers & Gender Independence
  console.log('\n===============================================================');
  console.log('CONTROLLED TEST: ALL 10 SQUAD POSITIONS & GENDER INDEPENDENCE');
  console.log('===============================================================');
  
  const testDemo = {
    totalBoys: 254,
    totalGirls: 87,
    squads: {
      Aditya: { boys: 25, girls: 8 },
      Bhaskar: { boys: 25, girls: 9 },
      Dinkar: { boys: 26, girls: 9 },
      Divakar: { boys: 24, girls: 8 },
      Mitra: { boys: 27, girls: 10 },
      Martand: { boys: 26, girls: 9 },
      Prabhakar: { boys: 25, girls: 8 },
      Ravi: { boys: 25, girls: 9 },
      Surya: { boys: 25, girls: 9 },
      Tejonidhi: { boys: 26, girls: 8 }
    }
  };

  const testSelections = [
    {
      day: 'Day 1',
      activity_title: 'Punctuality - Fall In',
      first_squad: 'Bhaskar, Dinkar, Divakar',
      second_squad: 'Divakar, Bhaskar, Dinkar',
      is_locked: false,
      selected_at: new Date('2026-09-20T08:00:00Z')
    }
  ];

  const testResult = calculateSquadPerformance(testSelections, testDemo);

  console.log('\nScenario Scores:');
  testResult.leaderboard.forEach(l => {
    if (['Bhaskar', 'Dinkar', 'Divakar'].includes(l.squad)) {
      console.log(`  Squad ${l.squad.padEnd(10)}: Fall-In Points = ${(l.punc_fall_in_points || 0).toFixed(4)} (Punc Score: ${l.categoryScores?.punctuality?.toFixed(4)}, Overall: ${l.overall_score.toFixed(4)}) | Medals: 🥇${l.first_count} 🥈${l.second_count} 🥉${l.third_count}`);
    }
  });

  const bhaskar = testResult.squadData['Bhaskar'];
  const dinkar = testResult.squadData['Dinkar'];
  const divakar = testResult.squadData['Divakar'];

  console.log(`\nBhaskar Expected: 1.9153, Actual: ${bhaskar.punc_fall_in_points}`);
  console.log(`Dinkar Expected: 1.7488, Actual: ${dinkar.punc_fall_in_points}`);
  console.log(`Divakar Expected: 1.6755, Actual: ${divakar.punc_fall_in_points}`);

  await pool.end();
}

runEndToEndVerification().catch(e => {
  console.error(e);
  process.exit(1);
});
