require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const pool = require('../config/db');
const { initDB, seedImmersionSchedules } = require('../config/initDb');

async function runScheduleSafetyTests() {
  console.log('🧪 Starting initDB Schedule Safety & Regression Tests...\n');

  let testBatchId = null;
  let testUserId = null;
  let legacySchedId = null;
  let customSchedId = null;
  let attId = null;
  let evalId = null;

  try {
    // Step 0: Ensure base schema is present
    await initDB(pool);

    // 1. Create a simulated existing LTC batch
    const batchRes = await pool.query(`
      INSERT INTO batches (name, location, start_date, end_date, status, batch_code, created_at)
      VALUES ('Safety Audit Test LTC Batch', 'LTC Pune', '2025-01-01', '2025-01-07', 'active', 'LTC-SAFE-01', NOW() - INTERVAL '6 months')
      RETURNING id
    `);
    testBatchId = batchRes.rows[0].id;
    console.log(`✅ [1/5] Created test LTC batch id: ${testBatchId}`);

    // Create a test student user for attendance & evaluation records
    const userRes = await pool.query(`
      INSERT INTO users (name, email, password, role, department, division, prn)
      VALUES ('Safety Test Student', 'safety_test_student@test.com', 'hashedpass', 'student', 'Comp', 'Div A', 'PRN-SAFE-001')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    testUserId = userRes.rows[0].id;

    // 2. Insert a legitimate LTC schedule
    const customSchedRes = await pool.query(`
      INSERT INTO schedules (batch_id, title, date, time, panel)
      VALUES ($1, 'LTC Keynote Leadership Session', 'Day 1', '10:00 AM', 'ALL')
      RETURNING id
    `, [testBatchId]);
    customSchedId = customSchedRes.rows[0].id;

    // 3. Insert a schedule with a legacy title to test legacy purge immunity
    const legacyTitle = 'Day 1: Room Allotment & Bag Check';
    const legacySchedRes = await pool.query(`
      INSERT INTO schedules (batch_id, title, date, time, panel)
      VALUES ($1, $2, 'Day 1', '08:00 AM', 'ALL')
      RETURNING id
    `, [testBatchId, legacyTitle]);
    legacySchedId = legacySchedRes.rows[0].id;

    // Insert attendance tied to the legacy schedule
    const attRes = await pool.query(`
      INSERT INTO attendance (batch_id, student_id, schedule_id, status)
      VALUES ($1, $2, $3, 'present')
      RETURNING id
    `, [testBatchId, testUserId, legacySchedId]);
    attId = attRes.rows[0].id;

    // Insert evaluation tied to the legacy schedule
    const evalRes = await pool.query(`
      INSERT INTO evaluations (student_id, schedule_id, marks, remarks)
      VALUES ($1, $2, 10, 'Excellent participation')
      RETURNING id
    `, [testUserId, legacySchedId]);
    evalId = evalRes.rows[0].id;

    console.log(`✅ [2/5] Created existing LTC schedules and dependent records (Attendance ID: ${attId}, Eval ID: ${evalId})`);

    // Verify initial schedule count for this batch
    const initialSchedCountRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM schedules WHERE batch_id = $1',
      [testBatchId]
    );
    const initialCount = initialSchedCountRes.rows[0].count;
    assert.strictEqual(initialCount, 2, 'Initial schedule count must be 2');

    // 4. Run initDB() multiple times (simulating server restarts)
    console.log('🔄 Simulating server boot 1: initDB(pool)...');
    await initDB(pool);

    console.log('🔄 Simulating server boot 2: initDB(pool)...');
    await initDB(pool);

    // Call seedImmersionSchedules directly as well to ensure it is completely disarmed
    console.log('🔄 Testing direct invocation: seedImmersionSchedules(pool)...');
    await seedImmersionSchedules(pool);

    // 5. Verification: Ensure NO 5-day immersion schedules were injected into the existing LTC batch
    const postBootSchedCountRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM schedules WHERE batch_id = $1',
      [testBatchId]
    );
    const postBootCount = postBootSchedCountRes.rows[0].count;
    assert.strictEqual(
      postBootCount,
      initialCount,
      `Schedule count must NOT increase during startup! Expected ${initialCount}, found ${postBootCount}`
    );
    console.log('✅ [3/5] Verified: initDB startup does NOT inject immersion schedules into existing batches');

    const immersionSchedsRes = await pool.query(
      "SELECT id FROM schedules WHERE batch_id = $1 AND title LIKE 'Day %: Agriculture & Nature'",
      [testBatchId]
    );
    assert.strictEqual(
      immersionSchedsRes.rowCount,
      0,
      'No immersion activity schedules should exist for this batch'
    );
    console.log('✅ [4/5] Verified: Zero 5-day immersion activities were added to existing LTC batch');

    // 6. Verification: Ensure legacy schedule, attendance, and evaluations were NOT deleted
    const verifyLegacySchedRes = await pool.query(
      'SELECT id FROM schedules WHERE id = $1',
      [legacySchedId]
    );
    assert.strictEqual(
      verifyLegacySchedRes.rowCount,
      1,
      'Schedule with legacy title must NOT be deleted by startup'
    );

    const verifyAttRes = await pool.query(
      'SELECT id FROM attendance WHERE id = $1',
      [attId]
    );
    assert.strictEqual(
      verifyAttRes.rowCount,
      1,
      'Existing attendance record must NOT be deleted by startup'
    );

    const verifyEvalRes = await pool.query(
      'SELECT id FROM evaluations WHERE id = $1',
      [evalId]
    );
    assert.strictEqual(
      verifyEvalRes.rowCount,
      1,
      'Existing evaluation record must NOT be deleted by startup'
    );
    console.log('✅ [5/5] Verified: Legacy schedules, attendance, and evaluations were preserved untouched');

    console.log('\n🎉 ALL STARTUP SCHEDULE & ATTENDANCE SAFETY TESTS PASSED PERFECTLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    // Clean up test data
    if (evalId) {
      await pool.query('DELETE FROM evaluations WHERE id = $1', [evalId]).catch(() => {});
    }
    if (attId) {
      await pool.query('DELETE FROM attendance WHERE id = $1', [attId]).catch(() => {});
    }
    if (testBatchId) {
      await pool.query('DELETE FROM schedules WHERE batch_id = $1', [testBatchId]).catch(() => {});
      await pool.query('DELETE FROM batches WHERE id = $1', [testBatchId]).catch(() => {});
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
    }
    await pool.end();
  }
}

runScheduleSafetyTests();
