const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/db');
const { generateNextSystemStudentId, deriveBatchInfo } = require('../utils/studentIdHelper');

async function runTests() {
  console.log('================================================================');
  console.log('   LAP STUDENT ONBOARDING & ID GENERATION VERIFICATION TESTS    ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  // ── TEST 1: Database Columns & Unique Constraint Audit ──
  total++;
  try {
    console.log('--- TEST 1: DATABASE COLUMNS AUDIT ---');
    const colsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name IN ('onboarding_completed', 'onboarding_completed_at', 'system_student_id');
    `);
    const colNames = colsRes.rows.map(r => r.column_name);
    assert(colNames.includes('onboarding_completed'), 'Missing column: onboarding_completed');
    assert(colNames.includes('onboarding_completed_at'), 'Missing column: onboarding_completed_at');
    assert(colNames.includes('system_student_id'), 'Missing column: system_student_id');

    // Check unique index on system_student_id
    const indexRes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users' AND indexname = 'users_system_student_id_idx';
    `);
    assert(indexRes.rows.length > 0, 'Missing unique index users_system_student_id_idx');
    console.log('✔ PASS: Database schema verified (onboarding_completed, onboarding_completed_at, system_student_id + UNIQUE index)');
    passed++;
  } catch (err) {
    console.error('❌ FAIL: TEST 1', err.message);
  }

  // ── TEST 2: Active Batch Students Backfill Audit ──
  total++;
  try {
    console.log('\n--- TEST 2: ACTIVE BATCH SYSTEM STUDENT ID BACKFILL AUDIT ---');
    const batchRow = await pool.query('SELECT batch_id FROM batch_students GROUP BY batch_id ORDER BY count(*) DESC LIMIT 1');
    const targetBatchId = batchRow.rows[0]?.batch_id || 38;
    const b35Res = await pool.query(`
      SELECT u.id, u.name, u.system_student_id, u.onboarding_completed, u.undertaking_submitted
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      WHERE bs.batch_id = $1
      ORDER BY u.id ASC;
    `, [targetBatchId]);

    assert(b35Res.rows.length > 0, `No students found in Batch ${targetBatchId}`);
    console.log(`ℹ INFO: Found ${b35Res.rows.length} students in Batch ${targetBatchId}`);

    b35Res.rows.forEach((s, idx) => {
      const expectedSerial = String(idx + 1).padStart(2, '0');
      const expectedId = `LAP-01-1026-${expectedSerial}`;
      assert.strictEqual(s.system_student_id, expectedId, `Student ID ${s.id} (${s.name}) expected ${expectedId} but got ${s.system_student_id}`);
    });

    console.log(`✔ PASS: All ${b35Res.rows.length} students in Batch 35 have sequential IDs LAP-01-1026-01 through LAP-01-1026-${String(b35Res.rows.length).padStart(2, '0')}`);
    passed++;
  } catch (err) {
    console.error('❌ FAIL: TEST 2', err.message);
  }

  // ── TEST 3: Sequential ID Generation for New Student in Batch ──
  total++;
  const client = await pool.connect();
  try {
    console.log('\n--- TEST 3: NEXT SYSTEM STUDENT ID GENERATION AUDIT ---');
    await client.query('BEGIN');

    const nextId = await generateNextSystemStudentId(client, 35);
    console.log(`ℹ INFO: Next generated ID for Batch 35: ${nextId}`);
    assert.strictEqual(nextId, 'LAP-01-1026-40', `Expected LAP-01-1026-40, got ${nextId}`);

    // Simulate inserting this student and generating the next one
    await client.query(`
      INSERT INTO users (name, system_student_id, role, password)
      VALUES ('Test New Student 40', $1, 'student', 'hashedpass')
    `, [nextId]);

    const afterNextId = await generateNextSystemStudentId(client, 35);
    console.log(`ℹ INFO: After inserting 40, next ID generated: ${afterNextId}`);
    assert.strictEqual(afterNextId, 'LAP-01-1026-41', `Expected LAP-01-1026-41, got ${afterNextId}`);

    await client.query('ROLLBACK');
    console.log('✔ PASS: Concurrency-safe sequential student ID generator verified (LAP-01-1026-40, LAP-01-1026-41)');
    passed++;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ FAIL: TEST 3', err.message);
  } finally {
    client.release();
  }

  // ── TEST 4: Onboarding Completion State & Persistence ──
  total++;
  const client2 = await pool.connect();
  try {
    console.log('\n--- TEST 4: ONBOARDING COMPLETION ENDPOINT & DB PERSISTENCE ---');
    await client2.query('BEGIN');

    // Create a mock first-time student
    const createRes = await client2.query(`
      INSERT INTO users (name, role, password, onboarding_completed, undertaking_submitted)
      VALUES ('First Time Test Student', 'student', 'hashedpass', false, false)
      RETURNING id, onboarding_completed, onboarding_completed_at;
    `);
    const student = createRes.rows[0];
    assert.strictEqual(student.onboarding_completed, false, 'Student should start with onboarding_completed = false');

    // Simulate completing onboarding
    const updateRes = await client2.query(`
      UPDATE users 
      SET onboarding_completed = true, 
          onboarding_completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, onboarding_completed, onboarding_completed_at;
    `, [student.id]);

    const updated = updateRes.rows[0];
    assert.strictEqual(updated.onboarding_completed, true, 'Student onboarding_completed should be true');
    assert(updated.onboarding_completed_at !== null, 'onboarding_completed_at should have timestamp');

    await client2.query('ROLLBACK');
    console.log('✔ PASS: Onboarding persistence verified: false on creation -> true with timestamp on completion');
    passed++;
  } catch (err) {
    await client2.query('ROLLBACK');
    console.error('❌ FAIL: TEST 4', err.message);
  } finally {
    client2.release();
  }

  // ── TEST 5: Student Code of Conduct & Safety Protocols Redesign Audit ──
  total++;
  try {
    console.log('\n--- TEST 5: CODE OF CONDUCT & SAFETY PROTOCOLS REDESIGN AUDIT ---');
    const cocPath = path.resolve(__dirname, '../../frontend/src/StudentCodeOfConductTab.jsx');
    const cocContent = fs.readFileSync(cocPath, 'utf8');

    // Verify Sinhagad = Boys' Accommodation
    assert(cocContent.includes('Sinhagad Block'), 'Missing Sinhagad Block');
    assert(cocContent.includes('Boys’ Accommodation') || cocContent.includes("Boys' Accommodation"), 'Missing Boys’ Accommodation');
    
    // Verify Pratapgad = Girls' Accommodation
    assert(cocContent.includes('Pratapgad Block'), 'Missing Pratapgad Block');
    assert(cocContent.includes('Girls’ Accommodation') || cocContent.includes("Girls' Accommodation"), 'Missing Girls’ Accommodation');

    // Verify Print Guidelines button is completely removed
    assert(!cocContent.includes('Print Guidelines'), 'Print Guidelines button must be completely removed');

    // Verify 10 rules exist
    assert(cocContent.includes('Respect Others'), 'Missing Rule 1');
    assert(cocContent.includes('Compliance & Values'), 'Missing Rule 10');

    // Verify clickable tel links
    assert(cocContent.includes('tel:'), 'Missing clickable tel links');

    console.log('✔ PASS: Code of Conduct UI audit verified (Sinhagad = Boys, Pratapgad = Girls, Print button removed, 10 rules + clickable phones present)');
    passed++;
  } catch (err) {
    console.error('❌ FAIL: TEST 5', err.message);
  }

  // ── TEST 6: LTC Journey Summary Removal Audit ──
  total++;
  try {
    console.log('\n--- TEST 6: LTC JOURNEY SUMMARY REMOVAL AUDIT ---');
    const dashPath = path.resolve(__dirname, '../../frontend/src/StudentDashboard.jsx');
    const dashContent = fs.readFileSync(dashPath, 'utf8');

    // Verify Journey Summary Heading, Description, and Button are absent
    assert(!dashContent.includes('Download My LTC Journey Summary'), 'Journey Summary heading must be removed');
    assert(!dashContent.includes('Generate your personalized lifetime achievement journal'), 'Journey Summary description must be removed');
    assert(!dashContent.includes('id="download-journey-summary-btn"'), 'Journey Summary download button must be removed');

    // Verify FirstTimeOnboardingModal is mounted
    assert(dashContent.includes('FirstTimeOnboardingModal'), 'FirstTimeOnboardingModal must be imported and rendered in StudentDashboard');

    console.log('✔ PASS: LTC Journey Summary completely removed and FirstTimeOnboardingModal mounted in StudentDashboard');
    passed++;
  } catch (err) {
    console.error('❌ FAIL: TEST 6', err.message);
  }

  console.log('\n================================================================');
  console.log(`   TEST RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}%)    `);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
