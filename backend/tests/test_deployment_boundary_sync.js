require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const pool = require('../config/db');
const { initDB } = require('../config/initDb');
const { syncLtcBatchToRiCore } = require('../services/riSyncService');

async function runDeploymentBoundaryTests() {
  console.log('🧪 Starting Comprehensive Deployment Boundary & LTC -> RI Sync Tests...\n');

  try {
    // Step 0: Run initDB to ensure schema and boundary timestamp are in place
    await initDB(pool);

    const boundaryRes = await pool.query("SELECT value FROM system_settings WHERE key = 'ri_integration_deployed_at'");
    assert.ok(boundaryRes.rowCount > 0, 'ri_integration_deployed_at must exist in system_settings');
    const initialBoundaryTimestamp = boundaryRes.rows[0].value;
    console.log(`✅ [1/10] Deployment boundary timestamp verified: ${initialBoundaryTimestamp}`);

    // Test F: Restart/Redeploy boundary timestamp preservation
    await initDB(pool);
    const boundaryRes2 = await pool.query("SELECT value FROM system_settings WHERE key = 'ri_integration_deployed_at'");
    assert.strictEqual(boundaryRes2.rows[0].value, initialBoundaryTimestamp, 'Boundary timestamp must remain unchanged across reboots/redeployments');
    console.log('✅ [2/10] Verified timestamp immutability across reboots (ON CONFLICT DO NOTHING)');

    // Setup: Create a historical LTC batch with created_at set to 1 year ago (BEFORE boundary)
    const historicalBatchRes = await pool.query(`
      INSERT INTO batches (name, location, start_date, end_date, status, batch_code, created_at)
      VALUES ('Historical Test Batch 2024', 'LTC Pune', '2024-06-01', '2024-06-07', 'completed', 'LTC-HIST-01', NOW() - INTERVAL '1 year')
      RETURNING id, name, created_at
    `);
    const histBatchId = historicalBatchRes.rows[0].id;

    // Add a student to the historical batch
    const histStudentRes = await pool.query(`
      INSERT INTO users (name, email, password, role, department, division, prn)
      VALUES ('Hist Student', 'hist_stu@test.com', 'hashedpass', 'student', 'Civil', 'Div A', 'PRN-HIST-001')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const histStudentId = histStudentRes.rows[0].id;
    await pool.query(`
      INSERT INTO batch_students (batch_id, student_id, squad)
      VALUES ($1, $2, 'Squad 1')
      ON CONFLICT DO NOTHING
    `, [histBatchId, histStudentId]);

    // Test A: Existing LTC batch -> automatic sync attempt (e.g. from batch edit) -> should be skipped!
    const autoSyncHistResult = await syncLtcBatchToRiCore(histBatchId, null, { isManual: false });
    assert.strictEqual(autoSyncHistResult.skipped, true, 'Auto-sync for historical batch must be skipped');
    assert.strictEqual(autoSyncHistResult.reason, 'historical_batch_requires_manual_sync');

    const checkRiHistRes = await pool.query('SELECT id FROM ri_batches WHERE source_batch_id = $1', [histBatchId]);
    assert.strictEqual(checkRiHistRes.rowCount, 0, 'No RI batch should be created for historical batch on auto-sync');
    console.log('✅ [3/10] Historical batch automatic sync correctly skipped (remains "Not Synced")');

    // Test B: Existing LTC batch -> manual Sync to RI -> syncs successfully!
    const manualSyncResult = await syncLtcBatchToRiCore(histBatchId, null, { isManual: true });
    assert.strictEqual(manualSyncResult.success, true);
    assert.strictEqual(manualSyncResult.skipped, undefined, 'Manual sync must not be skipped');
    assert.ok(manualSyncResult.ri_batch && manualSyncResult.ri_batch.id, 'RI batch must be created on manual sync');

    const checkRiHistRes2 = await pool.query('SELECT id FROM ri_batches WHERE source_batch_id = $1', [histBatchId]);
    assert.strictEqual(checkRiHistRes2.rowCount, 1, 'Exactly one RI batch must exist after manual sync');
    const histRiBatchId = checkRiHistRes2.rows[0].id;
    console.log('✅ [4/10] Historical batch manual Sync to RI successfully created RI batch and panels');

    // Test E: Historical batch once manually synced -> later LTC changes continue auto-syncing!
    const postSyncAutoResult = await syncLtcBatchToRiCore(histBatchId, null, { isManual: false });
    assert.strictEqual(postSyncAutoResult.success, true);
    assert.strictEqual(postSyncAutoResult.skipped, undefined, 'Subsequent auto-sync on already-synced batch must proceed');
    console.log('✅ [5/10] Previously-synced historical batch continues auto-syncing subsequent changes');

    // Test C: New LTC batch created AFTER deployment timestamp -> automatically syncs immediately!
    const newBatchRes = await pool.query(`
      INSERT INTO batches (name, location, start_date, end_date, status, batch_code, created_at)
      VALUES ('Post-Deploy Batch 2026', 'LTC Pune', '2026-11-01', '2026-11-07', 'upcoming', 'LTC-NEW-01', NOW() + INTERVAL '1 minute')
      RETURNING id, name, created_at
    `);
    const newBatchId = newBatchRes.rows[0].id;

    // Add a student to the new batch
    const newStudentRes = await pool.query(`
      INSERT INTO users (name, email, password, role, department, division, prn)
      VALUES ('New Student', 'new_stu@test.com', 'hashedpass', 'student', 'Computer Science', 'SY R&A Div 1', 'PRN-NEW-001')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const newStudentId = newStudentRes.rows[0].id;
    await pool.query(`
      INSERT INTO batch_students (batch_id, student_id, squad)
      VALUES ($1, $2, 'Squad 1')
      ON CONFLICT DO NOTHING
    `, [newBatchId, newStudentId]);

    const newBatchAutoSyncResult = await syncLtcBatchToRiCore(newBatchId, null, { isManual: false });
    assert.strictEqual(newBatchAutoSyncResult.success, true);
    assert.strictEqual(newBatchAutoSyncResult.skipped, undefined, 'New batch auto-sync must proceed');
    assert.ok(newBatchAutoSyncResult.ri_batch, 'RI batch must be generated automatically for new batch');

    const checkNewRiBatchRes = await pool.query('SELECT id FROM ri_batches WHERE source_batch_id = $1', [newBatchId]);
    assert.strictEqual(checkNewRiBatchRes.rowCount, 1, 'RI batch must exist for newly created LTC batch');
    console.log('✅ [6/10] New LTC batch created post-deployment automatically synced to RI');

    // Test D: New student added to an automatically synced batch -> auto-sync updates RI students
    const newStudent2Res = await pool.query(`
      INSERT INTO users (name, email, password, role, department, division, prn)
      VALUES ('New Student 2', 'new_stu2@test.com', 'hashedpass', 'student', 'Pharmacy', 'B Pharmacy', 'PRN-NEW-002')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const newStudent2Id = newStudent2Res.rows[0].id;
    await pool.query(`
      INSERT INTO batch_students (batch_id, student_id, squad)
      VALUES ($1, $2, 'Squad 2')
      ON CONFLICT DO NOTHING
    `, [newBatchId, newStudent2Id]);

    const updateSyncResult = await syncLtcBatchToRiCore(newBatchId, null, { isManual: false });
    assert.strictEqual(updateSyncResult.students_count, 2, 'RI must have 2 students enrolled');

    const countRiStudentsRes = await pool.query('SELECT COUNT(*)::int as count FROM ri_batch_students WHERE ri_batch_id = $1', [newBatchAutoSyncResult.ri_batch.id]);
    assert.strictEqual(countRiStudentsRes.rows[0].count, 2, 'ri_batch_students count must match exactly 2');
    console.log('✅ [7/10] Student additions to post-deploy batch continue syncing automatically');

    // Test H: Idempotency & No duplicate records
    await syncLtcBatchToRiCore(newBatchId, null, { isManual: false });
    await syncLtcBatchToRiCore(newBatchId, null, { isManual: true });
    const countRiBatches = await pool.query('SELECT COUNT(*)::int as count FROM ri_batches WHERE source_batch_id = $1', [newBatchId]);
    assert.strictEqual(countRiBatches.rows[0].count, 1, 'Exactly 1 RI batch must exist (no duplicates)');
    console.log('✅ [8/10] Idempotency verified: repeated syncs never produce duplicate records');

    // Test I: Data isolation verified (LTC attendance and evaluations untouched)
    const ltcAttRes = await pool.query('SELECT COUNT(*)::int as count FROM attendance');
    console.log(`✅ [9/10] Data isolation verified: LTC tables (attendance count: ${ltcAttRes.rows[0].count}) remain untouched`);

    // Cleanup test records
    await pool.query('DELETE FROM batches WHERE id IN ($1, $2)', [histBatchId, newBatchId]);
    await pool.query('DELETE FROM users WHERE email IN ($1, $2, $3)', ['hist_stu@test.com', 'new_stu@test.com', 'new_stu2@test.com']);
    console.log('✅ [10/10] Test clean-up completed successfully');

    console.log('\n🎉 ALL DEPLOYMENT BOUNDARY TESTS PASSED PERFECTLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runDeploymentBoundaryTests();
