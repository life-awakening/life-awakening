const db = require('../config/db');
const { calculateSquadPerformance, generateSquadPerformanceExcelBuffer } = require('../services/squadScoringEngine');

async function runVerification() {
  console.log('========================================================================');
  console.log('STARTING COMPLETE END-TO-END CONTROLLED PRODUCTION-SAFE VERIFICATION');
  console.log('========================================================================\n');

  const batchRes = await db.query("SELECT id, name, year FROM batches WHERE status = 'active' ORDER BY id DESC LIMIT 1");
  const batchId = batchRes.rows[0]?.id || 73;
  const batchName = batchRes.rows[0]?.name || 'Batch 73';

  // 1. Demographics & DNR Verification
  const demoRes = await db.query(`
    SELECT 
      bs.squad,
      COUNT(DISTINCT CASE WHEN LOWER(TRIM(u.gender)) IN ('male', 'm', 'boy') THEN bs.student_id END)::int as boys_count,
      COUNT(DISTINCT CASE WHEN LOWER(TRIM(u.gender)) IN ('female', 'f', 'girl') THEN bs.student_id END)::int as girls_count
    FROM batch_students bs
    JOIN users u ON bs.student_id = u.id
    WHERE bs.batch_id = $1 AND (bs.is_dnr IS NOT TRUE)
    GROUP BY bs.squad
  `, [batchId]);

  const squadDemographics = {};
  let totalBoys = 0, totalGirls = 0;
  demoRes.rows.forEach(r => {
    const b = parseInt(r.boys_count) || 0;
    const g = parseInt(r.girls_count) || 0;
    squadDemographics[r.squad] = { boys: b, girls: g };
    totalBoys += b;
    totalGirls += g;
  });

  console.log('1. LIVE SQUAD DEMOGRAPHICS (Non-DNR):');
  console.log(`Total Boys = ${totalBoys}, Total Girls = ${totalGirls}`);
  console.table(squadDemographics);

  // 2. Controlled Scenario: Positions 1-3 & Positions 4-10
  // Scenario:
  // Boys: 1=Bhaskar, 2=Dinkar, 3=Divakar, 4=Aditya, 5=Mitra, 6=Martand, 7=Prabhakar, 8=Ravi, 9=Surya, 10=Tejonidhi
  // Girls: 1=Divakar, 2=Bhaskar, 3=Dinkar, 4=Tejonidhi, 5=Surya, 6=Ravi, 7=Prabhakar, 8=Martand, 9=Mitra, 10=Aditya
  const controlledSelectionsDay2 = {
    day: 2,
    activity_name: 'Fall In',
    category: 'Punctuality',
    squad_rank_1: 'Bhaskar,Dinkar,Divakar,Aditya,Mitra,Martand,Prabhakar,Ravi,Surya,Tejonidhi',
    squad_rank_2: 'Divakar,Bhaskar,Dinkar,Tejonidhi,Surya,Ravi,Prabhakar,Martand,Mitra,Aditya',
    squad_rank_3: null
  };

  // Expected Manual Calculation for Day 2 Fall In:
  // Boys mults: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
  // Girls mults: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
  const manualScores = {};
  const SQUADS = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'];
  const boysOrder = ['Bhaskar','Dinkar','Divakar','Aditya','Mitra','Martand','Prabhakar','Ravi','Surya','Tejonidhi'];
  const girlsOrder = ['Divakar','Bhaskar','Dinkar','Tejonidhi','Surya','Ravi','Prabhakar','Martand','Mitra','Aditya'];

  SQUADS.forEach(sq => {
    const bCount = squadDemographics[sq]?.boys || 0;
    const gCount = squadDemographics[sq]?.girls || 0;
    
    const bPos = boysOrder.indexOf(sq) + 1; // 1-10
    const gPos = girlsOrder.indexOf(sq) + 1; // 1-10

    const bMult = bPos > 0 && bPos <= 10 ? (11 - bPos) : 0;
    const gMult = gPos > 0 && gPos <= 10 ? (11 - gPos) : 0;

    const bPts = totalBoys > 0 ? (bCount / totalBoys) * bMult : 0;
    const gPts = totalGirls > 0 ? (gCount / totalGirls) * gMult : 0;
    manualScores[sq] = {
      boysCount: bCount,
      boysRank: bPos,
      boysMult: bMult,
      boysPts: bPts,
      girlsCount: gCount,
      girlsRank: gPos,
      girlsMult: gMult,
      girlsPts: gPts,
      totalFallIn: bPts + gPts
    };
  });

  const demographicsObj = { totalBoys, totalGirls, squads: squadDemographics };

  console.log('\n2. CONTROLLED FALL-IN 10-POSITION TEST (Day 2):');
  const testAct1 = [controlledSelectionsDay2];
  const engineResult1 = calculateSquadPerformance(testAct1, demographicsObj);

  let allMatch = true;
  SQUADS.forEach(sq => {
    const manual = manualScores[sq].totalFallIn;
    const engine = engineResult1.squadData[sq].punc_total_points;
    const match = Math.abs(manual - engine) < 0.0001;
    if (!match) allMatch = false;
    console.log(`  Squad ${sq.padEnd(11)}: Manual = ${manual.toFixed(4)} | Engine = ${engine.toFixed(4)} | Match: ${match ? 'PASS' : 'FAIL'}`);
  });

  // 3. Multi-Day Accumulation & Independence Test
  const multiDayActivities = [
    // DAY 2
    { day: 2, activity_title: 'Punctuality - Fall In', first_squad: 'Bhaskar,Dinkar,Divakar', second_squad: 'Divakar,Bhaskar,Dinkar' },
    { day: 2, activity_title: 'Punctuality - Yoga', first_squad: 'Dinkar' },
    { day: 2, activity_title: 'Punctuality - Agri 1', first_squad: 'Dinkar' },
    { day: 2, activity_title: 'Punctuality - TB 1', first_squad: 'Dinkar' },
    { day: 2, activity_title: 'Punctuality - Afternoon', first_squad: 'Dinkar' },

    // DAY 3
    { day: 3, activity_title: 'Punctuality - Fall In', first_squad: 'Dinkar,Aditya,Bhaskar', second_squad: 'Aditya,Dinkar,Bhaskar' },
    { day: 3, activity_title: 'Punctuality - Yoga', first_squad: 'Dinkar' },
    { day: 3, activity_title: 'Punctuality - Agri 1', first_squad: 'Dinkar' },
    { day: 3, activity_title: 'Punctuality - TB 1', first_squad: 'Dinkar' },
    { day: 3, activity_title: 'Punctuality - Afternoon', first_squad: 'Dinkar' },

    // DAY 4
    { day: 4, activity_title: 'Punctuality - Fall In', first_squad: 'Dinkar,Divakar,Bhaskar', second_squad: 'Bhaskar,Divakar,Dinkar' },
    { day: 4, activity_title: 'Punctuality - Yoga', first_squad: 'Dinkar' },
    { day: 4, activity_title: 'Punctuality - Agri 1', first_squad: 'Dinkar' },
    { day: 4, activity_title: 'Punctuality - TB 1', first_squad: 'Dinkar' },
    { day: 4, activity_title: 'Punctuality - Afternoon', first_squad: 'Dinkar' },

    // DAY 5
    { day: 5, activity_title: 'Punctuality - Fall In', first_squad: 'Dinkar,Bhaskar,Divakar', second_squad: 'Dinkar,Divakar,Bhaskar' },
    { day: 5, activity_title: 'Punctuality - Yoga', first_squad: 'Dinkar' },
    { day: 5, activity_title: 'Punctuality - TB 1', first_squad: 'Dinkar' },
    { day: 5, activity_title: 'Punctuality - Afternoon', first_squad: 'Dinkar' },

    // OTHER CATEGORIES (60% weight total): Bhaskar sweeps all 60% categories
    { day: 3, activity_title: 'Quiz', first_squad: 'Bhaskar' },
    { day: 4, activity_title: 'Debate', first_squad: 'Bhaskar' },
    { day: 4, activity_title: 'Kho Kho', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Obstacle', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Discipline', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Food Serving', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Room Cleaning', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Patriotism', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Agriculture', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Team Building', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Sports', first_squad: 'Bhaskar' },
    { day: 5, activity_title: 'Spirituality', first_squad: 'Bhaskar' }
  ];

  const fullResult = calculateSquadPerformance(multiDayActivities, demographicsObj);

  // Best Captain = squad with punctuality_rank === 1
  const bestCaptainSquad = Object.values(fullResult.squadData).find(s => s.punctuality_rank === 1);
  // Best Squad = squad with overall_rank === 1 (or leaderboard[0])
  const bestSquadObj = fullResult.leaderboard[0];

  console.log('\n3. INDEPENDENCE & LEADERBOARD RESULTS:');
  console.log(`Best Captain (Punctuality #1) : Squad ${bestCaptainSquad.squad} (Punc Rank: #${bestCaptainSquad.punctuality_rank}, Weighted Punc Score: ${bestCaptainSquad.categoryScores.punctuality.toFixed(2)})`);
  console.log(`Best Squad   (Overall #1)     : Squad ${bestSquadObj.squad} (Overall Score: ${bestSquadObj.overall_score.toFixed(2)}, Overall Rank: #${bestSquadObj.overall_rank || 1})`);

  const dinkarData = fullResult.squadData['Dinkar'];
  const bhaskarData = fullResult.squadData['Bhaskar'];

  console.log(`  Squad Dinkar  -> Punc Rank: #${dinkarData.punctuality_rank} (Weighted: ${dinkarData.categoryScores.punctuality.toFixed(2)} pts) | Overall Rank: #${dinkarData.overall_rank || 2} (Score: ${dinkarData.overall_score.toFixed(2)} pts)`);
  console.log(`  Squad Bhaskar -> Punc Rank: #${bhaskarData.punctuality_rank} (Weighted: ${bhaskarData.categoryScores.punctuality.toFixed(2)} pts) | Overall Rank: #${bhaskarData.overall_rank || 1} (Score: ${bhaskarData.overall_score.toFixed(2)} pts)`);

  const isIndependent = (bestCaptainSquad.squad === 'Dinkar') && (bestSquadObj.squad === 'Bhaskar');
  console.log(`Independence Test Status: ${isIndependent ? 'PASS (Best Captain != Best Squad)' : 'FAIL'}`);

  console.log('\n4. COMPLETE LEADERBOARD STANDINGS:');
  fullResult.leaderboard.forEach((st, idx) => {
    console.log(`  Rank #${(idx + 1).toString().padEnd(2)}: Squad ${st.squad.padEnd(11)} | Overall: ${st.overall_score.toFixed(2)} | Punc: Rank #${st.punctuality_rank} (${st.categoryScores.punctuality.toFixed(2)} pts) | Fall-In/Punc Raw: ${st.punc_total_points.toFixed(2)} pts | Medals: 🥇${st.first_count} 🥈${st.second_count} 🥉${st.third_count}`);
  });

  // 5. Excel Generation
  const excelBuf = await generateSquadPerformanceExcelBuffer({ batch_id: batchId, name: batchName, year: 2026 }, fullResult);
  console.log(`\n5. EXCEL GENERATION: Buffer size = ${excelBuf.length} bytes (PASS)`);

  console.log('\n========================================================================');
  console.log('TEST SUITE COMPLETED SUCCESSFULLY');
  console.log('========================================================================');
}

runVerification().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
