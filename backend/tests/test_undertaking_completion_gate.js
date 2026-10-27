require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const API_BASE = process.env.API_URL || 'http://localhost:5001';

async function runUndertakingGateTests() {
  console.log('================================================================');
  console.log('UNDERTAKING COMPLETION GATE: E2E Integration & Security Test');
  console.log('================================================================');

  const suffix = Date.now();
  const passwordHash = await bcrypt.hash('Password@123', 10);
  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  let ltcBatchId, riBatchId, villageId, panelId;
  let dualStudentId, riOnlyStudentId;

  try {
    // 1. Setup Test Batches & Allocations
    const ltcBatchRes = await pool.query(`
      INSERT INTO batches (name, year, start_date, end_date, status, is_deleted)
      VALUES ($1, '2026', '2026-10-01', '2026-10-10', 'active', false)
      RETURNING id
    `, [`LTC Gate Batch ${suffix}`]);
    ltcBatchId = ltcBatchRes.rows[0].id;

    const riBatchRes = await pool.query(`
      INSERT INTO ri_batches (name, batch_code, status, source_program, source_batch_id)
      VALUES ($1, $2, 'active', 'RI_DIRECT', NULL)
      RETURNING id
    `, [`RI Gate Batch ${suffix}`, `RIGATE-${suffix}`]);
    riBatchId = riBatchRes.rows[0].id;

    const vilRes = await pool.query(`
      INSERT INTO ri_villages (ri_batch_id, name, location, taluka, district, status)
      VALUES ($1, 'Gate Village', 'Test Loc', 'Daund', 'Pune', 'Active')
      RETURNING id
    `, [riBatchId]);
    villageId = vilRes.rows[0].id;

    const panelRes = await pool.query(`
      INSERT INTO ri_panels (ri_batch_id, panel_number, name, ri_village_id)
      VALUES ($1, 1, 'Gate Panel', $2)
      RETURNING id
    `, [riBatchId, villageId]);
    panelId = panelRes.rows[0].id;

    // 2. Create Dual Student (LTC + RI)
    const dualUserRes = await pool.query(`
      INSERT INTO users (name, email, password, role, prn, roll_number, department, division, undertaking_submitted, status)
      VALUES ($1, $2, $3, 'student', $4, 'D101', 'Computer Engineering', 'A', false, 'active')
      RETURNING id, name, email, prn
    `, [`Dual Student ${suffix}`, `dual.${suffix}@example.com`, passwordHash, `PRN-D-${suffix}`]);
    dualStudentId = dualUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO batch_students (batch_id, student_id, squad, room)
      VALUES ($1, $2, 'Surya', 'R-101')
    `, [ltcBatchId, dualStudentId]);

    await pool.query(`
      INSERT INTO ri_batch_students (ri_batch_id, ri_panel_id, student_id, source_program, source_ltc_batch_id)
      VALUES ($1, $2, $3, 'LTC_SYNC', $4)
    `, [riBatchId, panelId, dualStudentId, ltcBatchId]);

    // 3. Create RI-Only Student
    const riOnlyUserRes = await pool.query(`
      INSERT INTO users (name, email, password, role, prn, roll_number, department, division, undertaking_submitted, status)
      VALUES ($1, $2, $3, 'student', $4, 'R101', 'Mechanical Engineering', 'B', false, 'active')
      RETURNING id, name, email, prn
    `, [`RI-Only Student ${suffix}`, `ri.${suffix}@example.com`, passwordHash, `PRN-R-${suffix}`]);
    riOnlyStudentId = riOnlyUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO ri_batch_students (ri_batch_id, ri_panel_id, student_id, source_program)
      VALUES ($1, $2, $3, 'RI_DIRECT')
    `, [riBatchId, panelId, riOnlyStudentId]);

    // Generate JWT tokens
    const dualToken = jwt.sign({ id: dualStudentId, email: dualUserRes.rows[0].email, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });
    const riOnlyToken = jwt.sign({ id: riOnlyStudentId, email: riOnlyUserRes.rows[0].email, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

    console.log('\n--- SCENARIO 1: DUAL (RI + LTC) STUDENT - GATE ENFORCEMENT ---');

    // Step 1.1: Verify LTC operational APIs are blocked (403 Forbidden)
    const ltcSchedRes = await fetch(`${API_BASE}/api/student/schedules`, {
      headers: { Authorization: `Bearer ${dualToken}` }
    });
    console.log(`[DUAL] GET /api/student/schedules with incomplete undertaking -> Status: ${ltcSchedRes.status}`);
    if (ltcSchedRes.status !== 403) throw new Error(`Expected 403, got ${ltcSchedRes.status}`);
    const ltcSchedBody = await ltcSchedRes.json();
    console.log(`  Body: ${ltcSchedBody.error || ltcSchedBody.message}`);

    const ltcAttRes = await fetch(`${API_BASE}/api/student/attendance`, {
      headers: { Authorization: `Bearer ${dualToken}` }
    });
    console.log(`[DUAL] GET /api/student/attendance with incomplete undertaking -> Status: ${ltcAttRes.status}`);
    if (ltcAttRes.status !== 403) throw new Error(`Expected 403, got ${ltcAttRes.status}`);

    // Step 1.2: Verify RI operational APIs are also blocked (403 Forbidden) because LTC undertaking is missing
    const riAttRes = await fetch(`${API_BASE}/api/ri/student/attendance`, {
      headers: { Authorization: `Bearer ${dualToken}` }
    });
    console.log(`[DUAL] GET /api/ri/student/attendance with incomplete undertaking -> Status: ${riAttRes.status}`);
    if (riAttRes.status !== 403) throw new Error(`Expected 403, got ${riAttRes.status}`);
    const riAttBody = await riAttRes.json();
    console.log(`  Body: ${riAttBody.error || riAttBody.message}`);

    const riActRes = await fetch(`${API_BASE}/api/ri/student/activities`, {
      headers: { Authorization: `Bearer ${dualToken}` }
    });
    console.log(`[DUAL] GET /api/ri/student/activities with incomplete undertaking -> Status: ${riActRes.status}`);
    if (riActRes.status !== 403) throw new Error(`Expected 403, got ${riActRes.status}`);

    // Step 1.3: Verify Profile status reports undertaking is incomplete
    const riProfRes = await fetch(`${API_BASE}/api/ri/student/profile`, {
      headers: { Authorization: `Bearer ${dualToken}` }
    });
    const riProfBody = await riProfRes.json();
    console.log(`[DUAL] Profile undertaking_status.submitted = ${riProfBody.undertaking_status?.submitted}`);
    if (riProfBody.undertaking_status?.submitted !== false) throw new Error('Expected undertaking_status.submitted = false');

    // Step 1.4: Dual student submits LTC Undertaking
    console.log('\n[DUAL] Submitting LTC Undertaking Form...');
    const ltcSubmitRes = await fetch(`${API_BASE}/api/student/submit-undertaking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dualToken}` },
      body: JSON.stringify({
        signed_name: `Dual Student ${suffix}`,
        signed_date: new Date().toISOString().split('T')[0],
        blood_group: 'O+',
        emergency_contact_name: 'Parent Name',
        emergency_contact_relation: 'Mother',
        emergency_contact_mobile: '9876543210'
      })
    });
    console.log(`[DUAL] POST /api/student/undertaking -> Status: ${ltcSubmitRes.status}`);
    if (ltcSubmitRes.status !== 200) throw new Error(`LTC Undertaking submission failed with status ${ltcSubmitRes.status}`);

    // Step 1.5: Verify both portals are completely UNLOCKED
    const ltcSchedUnlocked = await fetch(`${API_BASE}/api/student/schedules`, {
      headers: { Authorization: `Bearer ${dualToken}` }
    });
    console.log(`[DUAL] GET /api/student/schedules after submission -> Status: ${ltcSchedUnlocked.status} (UNLOCKED)`);
    if (ltcSchedUnlocked.status !== 200) throw new Error(`Expected 200, got ${ltcSchedUnlocked.status}`);

    const riAttUnlocked = await fetch(`${API_BASE}/api/ri/student/attendance`, {
      headers: { Authorization: `Bearer ${dualToken}` }
    });
    console.log(`[DUAL] GET /api/ri/student/attendance after submission -> Status: ${riAttUnlocked.status} (UNLOCKED)`);
    if (riAttUnlocked.status !== 200) throw new Error(`Expected 200, got ${riAttUnlocked.status}`);

    const riActUnlocked = await fetch(`${API_BASE}/api/ri/student/activities`, {
      headers: { Authorization: `Bearer ${dualToken}` }
    });
    console.log(`[DUAL] GET /api/ri/student/activities after submission -> Status: ${riActUnlocked.status} (UNLOCKED)`);
    if (riActUnlocked.status !== 200) throw new Error(`Expected 200, got ${riActUnlocked.status}`);

    console.log('\n--- SCENARIO 2: RI-ONLY STUDENT - GATE ENFORCEMENT ---');

    // Step 2.1: Verify RI-only student operational APIs are blocked (403 Forbidden)
    const riOnlyAttRes = await fetch(`${API_BASE}/api/ri/student/attendance`, {
      headers: { Authorization: `Bearer ${riOnlyToken}` }
    });
    console.log(`[RI-ONLY] GET /api/ri/student/attendance with incomplete undertaking -> Status: ${riOnlyAttRes.status}`);
    if (riOnlyAttRes.status !== 403) throw new Error(`Expected 403, got ${riOnlyAttRes.status}`);
    const riOnlyAttBody = await riOnlyAttRes.json();
    console.log(`  Body: ${riOnlyAttBody.error || riOnlyAttBody.message}`);

    // Step 2.2: Verify RI-only student is strictly blocked from LTC portal endpoints
    const riOnlyLtcRes = await fetch(`${API_BASE}/api/student/schedules`, {
      headers: { Authorization: `Bearer ${riOnlyToken}` }
    });
    console.log(`[RI-ONLY] Access to LTC /api/student/schedules -> Status: ${riOnlyLtcRes.status}`);
    if (riOnlyLtcRes.status !== 403) throw new Error(`Expected 403, got ${riOnlyLtcRes.status}`);

    // Step 2.3: RI-Only student submits RI Undertaking
    console.log('\n[RI-ONLY] Submitting RI Undertaking Form...');
    const riSubmitRes = await fetch(`${API_BASE}/api/ri/student/undertaking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${riOnlyToken}` },
      body: JSON.stringify({
        bloodGroup: 'A+',
        emergencyContactName: 'Guardian Name',
        emergencyContactRelation: 'Father',
        emergencyContactMobile: '9123456789',
        consentFieldWork: true,
        consentPhotoVideo: true,
        consentDosDonts: true,
        signedName: `RI-Only Student ${suffix}`,
        signedDate: new Date().toISOString().split('T')[0]
      })
    });
    console.log(`[RI-ONLY] POST /api/ri/student/undertaking -> Status: ${riSubmitRes.status}`);
    if (riSubmitRes.status !== 200) throw new Error(`RI Undertaking submission failed with status ${riSubmitRes.status}`);

    // Step 2.4: Verify RI portal is completely UNLOCKED for RI-Only student
    const riOnlyAttUnlocked = await fetch(`${API_BASE}/api/ri/student/attendance`, {
      headers: { Authorization: `Bearer ${riOnlyToken}` }
    });
    console.log(`[RI-ONLY] GET /api/ri/student/attendance after submission -> Status: ${riOnlyAttUnlocked.status} (UNLOCKED)`);
    if (riOnlyAttUnlocked.status !== 200) throw new Error(`Expected 200, got ${riOnlyAttUnlocked.status}`);

    // Step 2.5: Verify data integrity: RI undertaking did NOT touch users.undertaking_submitted
    const checkUser = await pool.query('SELECT undertaking_submitted FROM users WHERE id = $1', [riOnlyStudentId]);
    console.log(`[RI-ONLY] users.undertaking_submitted for RI-only student remains: ${checkUser.rows[0].undertaking_submitted}`);
    if (checkUser.rows[0].undertaking_submitted !== false) throw new Error('users.undertaking_submitted should remain false for RI-only');

    console.log('\n================================================================');
    console.log('ALL UNDERTAKING COMPLETION GATE TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================');
  } finally {
    // Teardown
    console.log('\nCleaning up synthetic test records...');
    if (dualStudentId) {
      await pool.query('DELETE FROM ri_batch_students WHERE student_id = $1', [dualStudentId]);
      await pool.query('DELETE FROM batch_students WHERE student_id = $1', [dualStudentId]);
      await pool.query('DELETE FROM users WHERE id = $1', [dualStudentId]);
    }
    if (riOnlyStudentId) {
      await pool.query('DELETE FROM ri_undertakings WHERE student_id = $1', [riOnlyStudentId]);
      await pool.query('DELETE FROM ri_batch_students WHERE student_id = $1', [riOnlyStudentId]);
      await pool.query('DELETE FROM users WHERE id = $1', [riOnlyStudentId]);
    }
    if (panelId) await pool.query('DELETE FROM ri_panels WHERE id = $1', [panelId]);
    if (villageId) await pool.query('DELETE FROM ri_villages WHERE id = $1', [villageId]);
    if (riBatchId) await pool.query('DELETE FROM ri_batches WHERE id = $1', [riBatchId]);
    if (ltcBatchId) await pool.query('DELETE FROM batches WHERE id = $1', [ltcBatchId]);
    console.log('Teardown complete.');
    await pool.end();
  }
}

runUndertakingGateTests().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
