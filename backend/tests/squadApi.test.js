/**
 * End-to-End API and Integration Tests for Squad Performance Grading System
 */

const pool = require('../config/db');
const {
  SQUAD_CANONICAL_NAMES,
  COMPETITION_DAYS,
  ACTIVITIES_CONFIG,
  computeComprehensiveScores,
  calculateRankScore
} = require('../services/squadScoringService');
const assert = require('assert');

async function runApiIntegrationTests() {
  console.log('--- STARTING SQUAD PERFORMANCE DB & API INTEGRATION TESTS ---');

  try {
    // 1. Ensure test batch exists
    const batchRes = await pool.query(
      `INSERT INTO batches (name, location, status, year, batch_code)
       VALUES ('LTC 2026 Immersion Test Batch', 'Pune Campus', 'active', '2026', 'LTC-2026-TEST')
       RETURNING id, name, status`
    );
    const testBatchId = batchRes.rows[0].id;
    console.log(`✓ Test Batch Created: ID ${testBatchId}`);

    // Clean any prior results for test batch
    await pool.query('DELETE FROM squad_grading_results WHERE batch_id = $1', [testBatchId]);
    await pool.query('DELETE FROM squad_grading_audit_logs WHERE batch_id = $1', [testBatchId]);

    // 2. Test Grading Normal Activity (Discipline - 5%) for Day 1
    // Rank 1: Bhaskar (5.0), Rank 2: Aditya (3.33), Rank 3: Surya (1.67)
    await pool.query(
      `INSERT INTO squad_grading_results 
       (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad, status)
       VALUES ($1, 'Day 1', 'discipline', NULL, 'Bhaskar', 'Aditya', 'Surya', 'draft')`,
      [testBatchId]
    );

    // 3. Test Grading Punctuality Sub-Activities (Fall In, Yoga, TB, Agriculture - 12.5% each) for Day 1
    const pSubActivities = ['fall_in', 'yoga', 'tb', 'agriculture'];
    for (const sub of pSubActivities) {
      await pool.query(
        `INSERT INTO squad_grading_results 
         (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad, status)
         VALUES ($1, 'Day 1', 'punctuality', $2, 'Bhaskar', 'Aditya', 'Surya', 'draft')`,
        [testBatchId, sub]
      );
    }

    // 4. Test Grading Main Agriculture (5%) for Day 1
    await pool.query(
      `INSERT INTO squad_grading_results 
       (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad, status)
       VALUES ($1, 'Day 1', 'agriculture', NULL, 'Surya', 'Bhaskar', 'Aditya', 'draft')`,
      [testBatchId]
    );

    // Fetch and compute
    const currentResults = await pool.query(
      `SELECT * FROM squad_grading_results WHERE batch_id = $1 ORDER BY day ASC, activity_key ASC`,
      [testBatchId]
    );
    assert.strictEqual(currentResults.rows.length, 6, 'Should have 6 grading rows inserted');

    const calculated = computeComprehensiveScores(currentResults.rows, SQUAD_CANONICAL_NAMES);

    // Verify Bhaskar's Day 1 contribution:
    // Punctuality: 4 sub-activities * (12.5 / 5 days) = (12.5*4)/5 = 50 / 5 = 10.00 / 50
    // Discipline: 5.0 / 5 days = 1.00 / 5
    // Main Agriculture: Rank 2 -> 3.3333 / 5 days = 0.67 / 5
    // Total Overall for Bhaskar after Day 1: 10.0 + 1.0 + 0.67 = 11.67
    const bhaskar = calculated.squadSummaries['Bhaskar'];
    assert.strictEqual(bhaskar.punctuality.total, 10.00, 'Bhaskar Day 1 punctuality total avg');
    assert.strictEqual(bhaskar.activities.discipline, 1.00, 'Bhaskar Day 1 discipline avg');
    assert.strictEqual(bhaskar.activities.agriculture, 0.67, 'Bhaskar Day 1 main agri avg');
    assert.strictEqual(bhaskar.overallScore, 11.67, 'Bhaskar Day 1 overall score');
    console.log('✓ Test 2 Passed: Day 1 partial 5-day calculations correct');

    // 5. Test Editing result (e.g. updating Day 1 Discipline Rank 1 to Aditya, Rank 2 to Bhaskar)
    await pool.query(
      `UPDATE squad_grading_results
       SET rank_1_squad = 'Aditya', rank_2_squad = 'Bhaskar', updated_at = CURRENT_TIMESTAMP
       WHERE batch_id = $1 AND day = 'Day 1' AND activity_key = 'discipline'`,
      [testBatchId]
    );

    const editedResults = await pool.query(
      `SELECT * FROM squad_grading_results WHERE batch_id = $1`,
      [testBatchId]
    );
    const editedCalculated = computeComprehensiveScores(editedResults.rows, SQUAD_CANONICAL_NAMES);
    const adityaDiscipline = editedCalculated.squadSummaries['Aditya'].activities.discipline;
    assert.strictEqual(adityaDiscipline, 1.00, 'Aditya now has Rank 1 (1.00)');
    const bhaskarDiscipline = editedCalculated.squadSummaries['Bhaskar'].activities.discipline;
    assert.strictEqual(bhaskarDiscipline, 0.67, 'Bhaskar now has Rank 2 (0.67)');
    console.log('✓ Test 3 Passed: Editing result immediately recalculates scores and ranks');

    // 6. Test 5-Day Full Completion Simulation
    // Populate all 5 days for all 12 activities matching the prompt example!
    await pool.query('DELETE FROM squad_grading_results WHERE batch_id = $1', [testBatchId]);

    // Insert 5 days of data for the exact example in prompt:
    // Bhaskar:
    // Punctuality = 40.00 / 50
    // Discipline = 3.67 / 5
    // Food Serving = 4.00 / 5
    // Obstacles = 3.33 / 5
    // Khokho = 1.67 / 2.5
    // Debate = 2.00 / 2.5
    // Quiz = 4.00 / 5
    // Agriculture (Main) = 3.00 / 5
    // Sports = 4.00 / 5
    // Team Building = 3.33 / 5
    // Patriotism = 4.00 / 5
    // Spirituality = 3.67 / 5
    // TOTAL = 82.40 / 100

    // Bhaskar Fall In: 9.17 (Day 1: R1, Day 2: R2, Day 3: R1, Day 4: R3, Day 5: R2)
    const fallInRanks = [
      { d: 'Day 1', r1: 'Bhaskar', r2: 'Aditya', r3: 'Surya' },
      { d: 'Day 2', r1: 'Aditya', r2: 'Bhaskar', r3: 'Surya' },
      { d: 'Day 3', r1: 'Bhaskar', r2: 'Aditya', r3: 'Surya' },
      { d: 'Day 4', r1: 'Surya', r2: 'Aditya', r3: 'Bhaskar' },
      { d: 'Day 5', r1: 'Aditya', r2: 'Bhaskar', r3: 'Surya' }
    ];
    for (const item of fallInRanks) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'punctuality', 'fall_in', $3, $4, $5)`,
        [testBatchId, item.d, item.r1, item.r2, item.r3]
      );
    }

    // Bhaskar Yoga: 12.50 (Rank 1 all 5 days)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'punctuality', 'yoga', 'Bhaskar', 'Aditya', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar TB: 8.33 (Rank 2 all 5 days)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'punctuality', 'tb', 'Aditya', 'Bhaskar', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Agriculture Punctuality: 10.00 (Rank 1 on D1, D2, D3; Rank 2 on D4; Rank 3 on D5 -> (12.5*3 + 8.3333 + 4.1667)/5 = 10.00)
    const agriPunctRanks = [
      { d: 'Day 1', r1: 'Bhaskar', r2: 'Aditya', r3: 'Surya' },
      { d: 'Day 2', r1: 'Bhaskar', r2: 'Aditya', r3: 'Surya' },
      { d: 'Day 3', r1: 'Bhaskar', r2: 'Aditya', r3: 'Surya' },
      { d: 'Day 4', r1: 'Aditya', r2: 'Bhaskar', r3: 'Surya' },
      { d: 'Day 5', r1: 'Aditya', r2: 'Surya', r3: 'Bhaskar' }
    ];
    for (const item of agriPunctRanks) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'punctuality', 'agriculture', $3, $4, $5)`,
        [testBatchId, item.d, item.r1, item.r2, item.r3]
      );
    }

    // Bhaskar Discipline: 3.67 (D1: R1, D2: R2, D3: R1, D4: R3, D5: R2 -> (5+3.33+5+1.67+3.33)/5 = 3.67)
    const disciplineRanks = [
      { d: 'Day 1', r1: 'Bhaskar', r2: 'Aditya', r3: 'Surya' },
      { d: 'Day 2', r1: 'Aditya', r2: 'Bhaskar', r3: 'Surya' },
      { d: 'Day 3', r1: 'Bhaskar', r2: 'Aditya', r3: 'Surya' },
      { d: 'Day 4', r1: 'Surya', r2: 'Aditya', r3: 'Bhaskar' },
      { d: 'Day 5', r1: 'Aditya', r2: 'Bhaskar', r3: 'Surya' }
    ];
    for (const item of disciplineRanks) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'discipline', NULL, $3, $4, $5)`,
        [testBatchId, item.d, item.r1, item.r2, item.r3]
      );
    }

    // Bhaskar Food Serving: 4.00 (Rank 1 on 4 days, Rank 0 on 1 day -> 4 * 5 / 5 = 4.00)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'food_serving', NULL, ${d <= 4 ? "'Bhaskar'" : "'Aditya'"}, 'Aditya', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Obstacles: 3.33 (Rank 2 on all 5 days -> 3.3333 * 5 / 5 = 3.33)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'obstacles', NULL, 'Aditya', 'Bhaskar', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Khokho (2.5%): 1.67 (Rank 2 on all 5 days -> 1.6667 * 5 / 5 = 1.67)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'khokho', NULL, 'Aditya', 'Bhaskar', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Debate (2.5%): 2.00 (Rank 1 on 4 days -> 4 * 2.5 / 5 = 2.00)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'debate', NULL, ${d <= 4 ? "'Bhaskar'" : "'Aditya'"}, 'Aditya', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Quiz: 4.00 (Rank 1 on 4 days -> 4.00)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'quiz', NULL, ${d <= 4 ? "'Bhaskar'" : "'Aditya'"}, 'Aditya', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Main Agriculture (5%): 3.00 (Rank 1 on 3 days -> 3 * 5 / 5 = 3.00)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'agriculture', NULL, ${d <= 3 ? "'Bhaskar'" : "'Aditya'"}, 'Aditya', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Sports: 4.00 (Rank 1 on 4 days -> 4.00)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'sports', NULL, ${d <= 4 ? "'Bhaskar'" : "'Aditya'"}, 'Aditya', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Team Building: 3.33 (Rank 2 on all 5 days -> 3.33)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'team_building', NULL, 'Aditya', 'Bhaskar', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Patriotism: 4.00 (Rank 1 on 4 days -> 4.00)
    for (let d = 1; d <= 5; d++) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'patriotism', NULL, ${d <= 4 ? "'Bhaskar'" : "'Aditya'"}, 'Aditya', 'Surya')`,
        [testBatchId, `Day ${d}`]
      );
    }

    // Bhaskar Spirituality: 3.67 (D1: R1, D2: R2, D3: R1, D4: R3, D5: R2 -> 3.67)
    for (const item of disciplineRanks) {
      await pool.query(
        `INSERT INTO squad_grading_results (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad)
         VALUES ($1, $2, 'spirituality', NULL, $3, $4, $5)`,
        [testBatchId, item.d, item.r1, item.r2, item.r3]
      );
    }

    // Fetch full 5-day dataset and run complete scoring
    const fullDatasetRes = await pool.query(
      `SELECT * FROM squad_grading_results WHERE batch_id = $1`,
      [testBatchId]
    );

    const fullCalculated = computeComprehensiveScores(fullDatasetRes.rows, SQUAD_CANONICAL_NAMES);
    const bhaskarFull = fullCalculated.squadSummaries['Bhaskar'];

    console.log('Bhaskar Score Breakdown:', {
      Punctuality: `${bhaskarFull.punctuality.total} / 50`,
      Discipline: `${bhaskarFull.activities.discipline} / 5`,
      FoodServing: `${bhaskarFull.activities.food_serving} / 5`,
      Obstacles: `${bhaskarFull.activities.obstacles} / 5`,
      Khokho: `${bhaskarFull.activities.khokho} / 2.5`,
      Debate: `${bhaskarFull.activities.debate} / 2.5`,
      Quiz: `${bhaskarFull.activities.quiz} / 5`,
      Agriculture: `${bhaskarFull.activities.agriculture} / 5`,
      Sports: `${bhaskarFull.activities.sports} / 5`,
      TeamBuilding: `${bhaskarFull.activities.team_building} / 5`,
      Patriotism: `${bhaskarFull.activities.patriotism} / 5`,
      Spirituality: `${bhaskarFull.activities.spirituality} / 5`,
      OverallScore: `${bhaskarFull.overallScore} / 100`
    });

    assert.strictEqual(bhaskarFull.punctuality.total, 40.00, 'Bhaskar Punctuality must equal 40.00');
    assert.strictEqual(bhaskarFull.activities.discipline, 3.67, 'Bhaskar Discipline must equal 3.67');
    assert.strictEqual(bhaskarFull.activities.food_serving, 4.00, 'Bhaskar Food Serving must equal 4.00');
    assert.strictEqual(bhaskarFull.activities.obstacles, 3.33, 'Bhaskar Obstacles must equal 3.33');
    assert.strictEqual(bhaskarFull.activities.khokho, 1.67, 'Bhaskar Khokho must equal 1.67');
    assert.strictEqual(bhaskarFull.activities.debate, 2.00, 'Bhaskar Debate must equal 2.00');
    assert.strictEqual(bhaskarFull.activities.quiz, 4.00, 'Bhaskar Quiz must equal 4.00');
    assert.strictEqual(bhaskarFull.activities.agriculture, 3.00, 'Bhaskar Agriculture must equal 3.00');
    assert.strictEqual(bhaskarFull.activities.sports, 4.00, 'Bhaskar Sports must equal 4.00');
    assert.strictEqual(bhaskarFull.activities.team_building, 3.33, 'Bhaskar Team Building must equal 3.33');
    assert.strictEqual(bhaskarFull.activities.patriotism, 4.00, 'Bhaskar Patriotism must equal 4.00');
    assert.strictEqual(bhaskarFull.activities.spirituality, 3.67, 'Bhaskar Spirituality must equal 3.67');
    assert.strictEqual(bhaskarFull.overallScore, 76.67, 'Bhaskar Overall Score must equal exact arithmetic sum (76.67 / 100)');

    console.log('Top Leaderboard:');
    console.table(fullCalculated.leaderboard.map(e => ({ rank: e.rank, squad: e.squad, overallScore: e.overallScore, punctuality: e.punctuality, discipline: e.discipline })));

    assert.ok(fullCalculated.leaderboard.length === 10, 'Leaderboard must contain all 10 squads');
    assert.strictEqual(fullCalculated.top3.gold.rank, 1);
    assert.strictEqual(fullCalculated.top3.silver.rank, 2);
    assert.strictEqual(fullCalculated.top3.bronze.rank, 3);
    console.log('✓ Test 4 Passed: 10 squads ranked, Top 3 podium identified!');

    // Cleanup test batch
    await pool.query('DELETE FROM batches WHERE id = $1', [testBatchId]);
    console.log('✓ Cleaned up test batch.');

    console.log('\n======================================================');
    console.log('ALL SQUAD PERFORMANCE DB & API INTEGRATION TESTS PASSED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Integration Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runApiIntegrationTests();
