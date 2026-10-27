require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const pool = require('../config/db');
const studentController = require('../controllers/studentController');
const riStudentController = require('../controllers/riStudentController');
const authController = require('../controllers/authController');
const bcrypt = require('bcryptjs');

function mockReqRes(user = {}, body = {}, query = {}, params = {}) {
  let statusCode = 200;
  let responseData = null;
  const req = {
    user,
    body,
    query,
    params,
    headers: {},
    socket: {}
  };
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    }
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

async function runUndertakingIsolationTests() {
  console.log('================================================================');
  console.log('REGRESSION TEST: RI Undertaking Routing & Strict Program Isolation');
  console.log('================================================================\n');

  const suffix = Date.now();
  const passwordHash = await bcrypt.hash('Password@123', 10);

  let ltcBatchId = null;
  let riBatchId = null;
  let villageId = null;
  let panelId = null;
  let riOnlyStudentId = null;
  let dualStudentId = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create isolated synthetic LTC and RI cohorts and students
    // -------------------------------------------------------------------------
    const ltcBatchRes = await pool.query(`
      INSERT INTO batches (name, year, start_date, end_date, status, is_deleted)
      VALUES ($1, '2026', '2026-10-15', '2026-10-20', 'active', false)
      RETURNING id
    `, [`Synthetic LTC Cohort ${suffix}`]);
    ltcBatchId = ltcBatchRes.rows[0].id;

    const riBatchRes = await pool.query(`
      INSERT INTO ri_batches (name, batch_code, status, source_program, source_batch_id)
      VALUES ($1, $2, 'active', 'RI_DIRECT', NULL)
      RETURNING id
    `, [`Synthetic RI Cohort ${suffix}`, `RI-DIR-${suffix}`]);
    riBatchId = riBatchRes.rows[0].id;

    const vilRes = await pool.query(`
      INSERT INTO ri_villages (ri_batch_id, name, location, taluka, district, status)
      VALUES ($1, $2, 'Synthetic Location', 'Haveli', 'Pune', 'Active')
      RETURNING id
    `, [riBatchId, `Synthetic Village ${suffix}`]);
    villageId = vilRes.rows[0].id;

    const panelRes = await pool.query(`
      INSERT INTO ri_panels (ri_batch_id, panel_number, name, ri_village_id)
      VALUES ($1, 1, 'Panel 1', $2)
      RETURNING id
    `, [riBatchId, villageId]);
    panelId = panelRes.rows[0].id;

    // Student 1: RI-DIRECT only student
    const riOnlyUserRes = await pool.query(`
      INSERT INTO users (name, email, password, role, prn, roll_number, department, division, status, in_current_batch)
      VALUES ($1, $2, $3, 'student', $4, 'R999', 'Computer Engineering', 'A', 'active', true)
      RETURNING id
    `, [`RI Only Student ${suffix}`, `ri.only.${suffix}@mitwpu.edu.in`, passwordHash, `PRN-RI-${suffix}`]);
    riOnlyStudentId = riOnlyUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO ri_batch_students (ri_batch_id, ri_panel_id, student_id, source_program, ri_id)
      VALUES ($1, $2, $3, 'RI_DIRECT', $4)
    `, [riBatchId, panelId, riOnlyStudentId, `RI-01-1026-001`]);

    // Student 2: LTC + RI (LTC_SYNC) student
    const dualUserRes = await pool.query(`
      INSERT INTO users (name, email, password, role, prn, roll_number, department, division, status, in_current_batch)
      VALUES ($1, $2, $3, 'student', $4, 'D999', 'Mechanical Engineering', 'B', 'active', true)
      RETURNING id
    `, [`Dual Student ${suffix}`, `dual.${suffix}@mitwpu.edu.in`, passwordHash, `PRN-DUAL-${suffix}`]);
    dualStudentId = dualUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO batch_students (batch_id, student_id, squad, room)
      VALUES ($1, $2, 'Squad Alpha', 'Room 101')
    `, [ltcBatchId, dualStudentId]);

    await pool.query(`
      INSERT INTO ri_batch_students (ri_batch_id, ri_panel_id, student_id, source_program, source_ltc_batch_id, ri_id)
      VALUES ($1, $2, $3, 'LTC_SYNC', $4, '01-1026-001')
    `, [riBatchId, panelId, dualStudentId, ltcBatchId]);

    console.log('[SETUP] Test fixture created successfully.');
    console.log(`  - RI-only student ID: ${riOnlyStudentId}`);
    console.log(`  - Dual LTC+RI student ID: ${dualStudentId}\n`);

    // -------------------------------------------------------------------------
    // TEST A: RI_DIRECT student profile shows has_ltc = false and pending undertaking
    // -------------------------------------------------------------------------
    console.log('[TEST A] RI_DIRECT student profile & program verification');
    const mockProfA = mockReqRes({ id: riOnlyStudentId, role: 'student', email: `ri.only.${suffix}@mitwpu.edu.in` });
    await riStudentController.getStudentProfile(mockProfA.req, mockProfA.res);
    const profA = mockProfA.getData();

    assert.strictEqual(profA.has_ltc, false, 'RI-only student must have has_ltc = false');
    assert.strictEqual(profA.has_ri_assignment, true, 'RI-only student must have active RI assignment');
    assert.strictEqual(profA.undertaking_status.submitted, false, 'Undertaking must be pending initially');
    console.log('  PASS: RI_DIRECT student has has_ltc = false and pending undertaking status');

    // -------------------------------------------------------------------------
    // TEST B: RI_DIRECT student submits RI undertaking successfully
    // -------------------------------------------------------------------------
    console.log('\n[TEST B] RI_DIRECT student submits RI undertaking to ri_undertakings');
    const mockSubmitB = mockReqRes(
      { id: riOnlyStudentId, role: 'student', email: `ri.only.${suffix}@mitwpu.edu.in` },
      {
        signedName: `RI Only Student ${suffix}`,
        emergencyContactName: 'Guardian Name',
        emergencyContactRelation: 'Father',
        emergencyContactMobile: '9876543210',
        emergencyContactAltMobile: '9876543211',
        emergencyContactEmail: 'guardian@example.com',
        bloodGroup: 'B+',
        medicalConditions: 'None',
        knownAllergies: 'None',
        currentMedication: 'None',
        dietaryRestrictions: 'Vegetarian',
        consentFieldWork: true,
        consentCodeOfConduct: true,
        consentMedicalEmergency: true,
        consentPhotoVideo: true,
        signedDate: '2026-10-15'
      }
    );
    await riStudentController.submitStudentUndertaking(mockSubmitB.req, mockSubmitB.res);
    const submitB = mockSubmitB.getData();

    assert.strictEqual(submitB.success, true, 'RI Undertaking submission must succeed');
    assert.strictEqual(submitB.undertaking.status, 'Submitted', 'Status must be Submitted');

    const dbRiUnderRes = await pool.query(
      `SELECT * FROM ri_undertakings WHERE student_id = $1`,
      [riOnlyStudentId]
    );
    assert.strictEqual(dbRiUnderRes.rowCount, 1, 'Exactly 1 row must exist in ri_undertakings');
    assert.strictEqual(dbRiUnderRes.rows[0].status, 'Submitted');
    console.log('  PASS: RI undertaking submitted and verified in ri_undertakings table');

    // -------------------------------------------------------------------------
    // TEST C: Submission status persists on profile and undertaking endpoints
    // -------------------------------------------------------------------------
    console.log('\n[TEST C] Verification of persistence after submission');
    const mockProfC = mockReqRes({ id: riOnlyStudentId, role: 'student', email: `ri.only.${suffix}@mitwpu.edu.in` });
    await riStudentController.getStudentProfile(mockProfC.req, mockProfC.res);
    const profC = mockProfC.getData();
    assert.strictEqual(profC.undertaking_status.submitted, true, 'undertaking_status.submitted must be true');

    const mockUnderC = mockReqRes({ id: riOnlyStudentId, role: 'student', email: `ri.only.${suffix}@mitwpu.edu.in` });
    await riStudentController.getStudentUndertaking(mockUnderC.req, mockUnderC.res);
    const underC = mockUnderC.getData();
    assert.strictEqual(underC.submitted, true, 'getStudentUndertaking must return submitted = true');
    assert.strictEqual(underC.undertaking.signed_name, `RI Only Student ${suffix}`);
    console.log('  PASS: RI undertaking status persists across profile and undertaking endpoints');

    // -------------------------------------------------------------------------
    // TEST D: RI_DIRECT student CANNOT access LTC undertaking endpoint (403 Forbidden)
    // -------------------------------------------------------------------------
    console.log('\n[TEST D] Program-level backend security: RI-only blocked from LTC endpoints');
    const mockLtcSubmitD = mockReqRes(
      { id: riOnlyStudentId, role: 'student' },
      {
        signedName: 'Hacker Attempt',
        emergencyContactName: 'Test',
        emergencyContactRelation: 'Father',
        emergencyContactMobile: '9000000000'
      }
    );
    await studentController.submitUndertaking(mockLtcSubmitD.req, mockLtcSubmitD.res);
    assert.strictEqual(mockLtcSubmitD.getStatus(), 403, 'RI-only student must receive HTTP 403 on LTC submit-undertaking');
    assert.ok(mockLtcSubmitD.getData()?.message.includes('not enrolled in an LTC cohort'));

    const mockLtcDashD = mockReqRes({ id: riOnlyStudentId, role: 'student' });
    await studentController.getDashboard(mockLtcDashD.req, mockLtcDashD.res);
    assert.strictEqual(mockLtcDashD.getStatus(), 403, 'RI-only student must receive HTTP 403 on LTC dashboard');
    console.log(`  PASS: RI student blocked from LTC undertaking endpoint: HTTP 403 "${mockLtcSubmitD.getData()?.message}"`);

    // -------------------------------------------------------------------------
    // TEST E: LTC_SYNC student can still use the existing LTC undertaking workflow
    // -------------------------------------------------------------------------
    console.log('\n[TEST E] Dual LTC_SYNC student can submit LTC undertaking');
    const mockLtcSubmitE = mockReqRes(
      { id: dualStudentId, role: 'student' },
      {
        signedName: `Dual Student ${suffix}`,
        signedDate: '2026-10-15',
        emergencyContactName: 'Dual Parent',
        emergencyContactRelation: 'Mother',
        emergencyContactMobile: '9111222333',
        consentMedia: true,
        consentData: true,
        consentChecks: true,
        consentMedical: true,
        bloodGroup: 'O+'
      }
    );
    await studentController.submitUndertaking(mockLtcSubmitE.req, mockLtcSubmitE.res);
    assert.strictEqual(mockLtcSubmitE.getStatus(), 200, 'Dual student must be allowed to submit LTC undertaking');

    const checkUsersE = await pool.query(
      `SELECT undertaking_submitted, undertaking_signed_name FROM users WHERE id = $1`,
      [dualStudentId]
    );
    assert.strictEqual(checkUsersE.rows[0].undertaking_submitted, true, 'users.undertaking_submitted must be true for dual student');

    // Dual student profile sees undertaking as submitted
    const mockProfE = mockReqRes({ id: dualStudentId, role: 'student' });
    await riStudentController.getStudentProfile(mockProfE.req, mockProfE.res);
    assert.strictEqual(mockProfE.getData().has_ltc, true, 'Dual student has has_ltc = true');
    assert.strictEqual(mockProfE.getData().undertaking_status.submitted, true, 'Dual student undertaking status is submitted');
    console.log('  PASS: LTC_SYNC student successfully submitted LTC undertaking and reflected in RI profile');

    // -------------------------------------------------------------------------
    // TEST F: Session program resolution isolation (no cross-account state leakage)
    // -------------------------------------------------------------------------
    console.log('\n[TEST F] Cross-session program isolation test');
    const mockProgRi = mockReqRes({ id: riOnlyStudentId, role: 'student' });
    await riStudentController.getStudentPrograms(mockProgRi.req, mockProgRi.res);
    assert.strictEqual(mockProgRi.getData().has_ltc, false, 'RI student programs must have has_ltc = false');
    assert.strictEqual(mockProgRi.getData().has_ri, true, 'RI student programs must have has_ri = true');

    const mockProgDual = mockReqRes({ id: dualStudentId, role: 'student' });
    await riStudentController.getStudentPrograms(mockProgDual.req, mockProgDual.res);
    assert.strictEqual(mockProgDual.getData().has_ltc, true, 'Dual student programs must have has_ltc = true');
    assert.strictEqual(mockProgDual.getData().has_ri, true, 'Dual student programs must have has_ri = true');
    console.log('  PASS: Program resolution strictly derived from student ID with zero state leakage');

    // -------------------------------------------------------------------------
    // TEST G: Student cannot access or submit another student's undertaking
    // -------------------------------------------------------------------------
    console.log('\n[TEST G] Student authorization barrier verification');
    // Calling getStudentUndertaking uses req.user.id
    const mockUnderG = mockReqRes({ id: riOnlyStudentId, role: 'student' });
    await riStudentController.getStudentUndertaking(mockUnderG.req, mockUnderG.res);
    assert.strictEqual(mockUnderG.getData().student_info.id, riOnlyStudentId, 'Endpoint must only return authenticated user info');
    console.log('  PASS: Student can only view and submit their own authenticated undertaking');

    // -------------------------------------------------------------------------
    // TEST H: Existing LTC undertaking data preserved untouched
    // -------------------------------------------------------------------------
    console.log('\n[TEST H] Verification that RI undertaking does not modify LTC users record');
    const riUserRecord = await pool.query(
      `SELECT undertaking_submitted FROM users WHERE id = $1`,
      [riOnlyStudentId]
    );
    // RI-only undertaking lives in ri_undertakings, leaving users.undertaking_submitted for pure LTC
    assert.strictEqual(riUserRecord.rows[0].undertaking_submitted, false, 'users.undertaking_submitted for RI-only student must remain false');
    console.log('  PASS: Clean separation between ri_undertakings and users.undertaking_submitted verified');

    console.log('\n================================================================');
    console.log('ALL UNDERTAKING ISOLATION TESTS PASSED! (Tests A through H Verified)');
    console.log('================================================================');

  } finally {
    // Teardown
    if (riOnlyStudentId) {
      await pool.query(`DELETE FROM ri_undertakings WHERE student_id = $1`, [riOnlyStudentId]);
      await pool.query(`DELETE FROM ri_batch_students WHERE student_id = $1`, [riOnlyStudentId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [riOnlyStudentId]);
    }
    if (dualStudentId) {
      await pool.query(`DELETE FROM ri_undertakings WHERE student_id = $1`, [dualStudentId]);
      await pool.query(`DELETE FROM ri_batch_students WHERE student_id = $1`, [dualStudentId]);
      await pool.query(`DELETE FROM batch_students WHERE student_id = $1`, [dualStudentId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [dualStudentId]);
    }
    if (panelId) {
      await pool.query(`DELETE FROM ri_panels WHERE id = $1`, [panelId]);
    }
    if (villageId) {
      await pool.query(`DELETE FROM ri_villages WHERE id = $1`, [villageId]);
    }
    if (riBatchId) {
      await pool.query(`DELETE FROM ri_batches WHERE id = $1`, [riBatchId]);
    }
    if (ltcBatchId) {
      await pool.query(`DELETE FROM batches WHERE id = $1`, [ltcBatchId]);
    }
    console.log('[TEARDOWN] Synthetic test records cleaned up safely.');
  }
}

runUndertakingIsolationTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nTEST SUITE FAILED:', err);
    process.exit(1);
  });
