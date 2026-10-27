const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { syncLtcBatchToRiCore } = require('../services/riSyncService');
const riController = require('../controllers/riController');
const authController = require('../controllers/authController');
const riStudentController = require('../controllers/riStudentController');

async function runVerification() {
  console.log('====================================================');
  console.log('Starting End-to-End Verification: Flow A & Flow B');
  console.log('====================================================\n');

  const testSuffix = Date.now();
  const testPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  // ─────────────────────────────────────────────────────────────
  // 1. FLOW A: LTC + RI SYNC WORKFLOW
  // ─────────────────────────────────────────────────────────────
  console.log('--- [FLOW A] Starting LTC + RI Sync Flow ---');

  // A1. Create LTC Batch
  const ltcBatchCode = `LTC-A-${testSuffix}`;
  const ltcBatchName = `LTC Cohort A ${testSuffix}`;
  const ltcBatchRes = await pool.query(`
    INSERT INTO batches (name, batch_code, start_date, end_date, capacity, status)
    VALUES ($1, $2, '2026-10-01', '2026-10-10', 120, 'active')
    RETURNING id, name, batch_code
  `, [ltcBatchName, ltcBatchCode]);
  const ltcBatch = ltcBatchRes.rows[0];
  console.log(`✓ A1: Created LTC Batch "${ltcBatch.name}" (ID: ${ltcBatch.id}, Code: ${ltcBatch.batch_code})`);

  // A2. Create LTC Student
  const ltcPrn = `PRN-A-${testSuffix}`;
  const ltcEmail = `student.a.${testSuffix}@example.com`;
  const ltcUserRes = await pool.query(`
    INSERT INTO users (name, email, password, role, prn, division, department)
    VALUES ($1, $2, $3, 'student', $4, 'A', 'Computer Science')
    RETURNING id, name, email, prn
  `, [`LTC Synced Student ${testSuffix}`, ltcEmail, hashedPassword, ltcPrn]);
  const ltcStudent = ltcUserRes.rows[0];

  // Enroll student into LTC batch_students
  await pool.query(`
    INSERT INTO batch_students (batch_id, student_id, squad)
    VALUES ($1, $2, 'Surya')
  `, [ltcBatch.id, ltcStudent.id]);
  console.log(`✓ A2: Created LTC Student "${ltcStudent.name}" and enrolled in LTC batch_students`);

  // A3. Sync LTC Batch to RI
  console.log('A3: Executing syncLtcBatchToRiCore...');
  const syncResult = await syncLtcBatchToRiCore(ltcBatch.id);
  console.log(`✓ A3: Synced to RI: Batch ID ${syncResult.ri_batch.id}, ${syncResult.panels_count} panels, ${syncResult.students_count} students synced`);

  // Verify RI Batch record
  const syncedRiBatchRes = await pool.query(
    `SELECT * FROM ri_batches WHERE source_batch_id = $1`,
    [ltcBatch.id]
  );
  if (syncedRiBatchRes.rowCount === 0) throw new Error('Synced RI batch not found!');
  const syncedRiBatch = syncedRiBatchRes.rows[0];
  console.log(`✓ A3 verification: RI Batch source_program = "${syncedRiBatch.source_program}", source_batch_id = ${syncedRiBatch.source_batch_id}`);
  if (syncedRiBatch.source_program !== 'LTC_SYNC' && syncedRiBatch.source_program !== 'LTC') {
    throw new Error(`Expected source_program to be LTC_SYNC or LTC, got ${syncedRiBatch.source_program}`);
  }

  // Verify Student in ri_batch_students
  const syncedStudentRes = await pool.query(
    `SELECT * FROM ri_batch_students WHERE ri_batch_id = $1 AND student_id = $2`,
    [syncedRiBatch.id, ltcStudent.id]
  );
  if (syncedStudentRes.rowCount === 0) throw new Error('Student not found in ri_batch_students!');
  const syncedStudent = syncedStudentRes.rows[0];
  console.log(`✓ A3 student verification: Student enrolled in RI with source_program = "${syncedStudent.source_program}", source_ltc_batch_id = ${syncedStudent.source_ltc_batch_id}`);

  // A4. Panel, Village, Faculty in Synced Batch
  const panelRes = await pool.query(
    `SELECT id, name, panel_number FROM ri_panels WHERE ri_batch_id = $1 LIMIT 1`,
    [syncedRiBatch.id]
  );
  const panelA = panelRes.rows[0];

  const villageARes = await pool.query(`
    INSERT INTO ri_villages (ri_batch_id, name, location, district)
    VALUES ($1, $2, 'Village Location A', 'District A')
    RETURNING id, name
  `, [syncedRiBatch.id, `Village A ${testSuffix}`]);
  const villageA = villageARes.rows[0];

  // Assign village to panel
  await pool.query(`UPDATE ri_panels SET ri_village_id = $1 WHERE id = $2`, [villageA.id, panelA.id]);

  // Create Faculty and assign to panel
  const facultyEmailA = `faculty.a.${testSuffix}@example.com`;
  await pool.query(`
    INSERT INTO ri_batch_faculty (ri_batch_id, ri_panel_id, name, email, role, status)
    VALUES ($1, $2, 'Faculty Mentor A', $3, 'Mentor', 'active')
  `, [syncedRiBatch.id, panelA.id, facultyEmailA]);
  console.log(`✓ A4: Created Village "${villageA.name}", assigned to Panel ${panelA.id}, and assigned Faculty "${facultyEmailA}"`);

  // A5. Student Login & Dual Access Verification
  const studentLoginMockA = {
    user: null,
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.user = d.user; }
  };
  await authController.login({ body: { email: ltcEmail, password: testPassword } }, studentLoginMockA);
  console.log(`✓ A5: Student logged in. Programs: has_ltc=${studentLoginMockA.user?.programs?.has_ltc}, has_ri=${studentLoginMockA.user?.programs?.has_ri}`);
  if (!studentLoginMockA.user?.programs?.has_ltc || !studentLoginMockA.user?.programs?.has_ri) {
    throw new Error('Flow A failure: LTC-synced student must have both has_ltc=true and has_ri=true!');
  }

  // A6. RI Forms Check for Flow A student
  let formsDataA = null;
  const formsMockA = {
    status(c) { return this; },
    json(d) { formsDataA = d; }
  };
  await riStudentController.getStudentFormsHub({ user: { id: ltcStudent.id } }, formsMockA);
  if (!formsDataA || formsDataA.message?.includes('No active Rural Immersion')) {
    throw new Error('Flow A failure: LTC student could not access RI forms!');
  }
  console.log(`✓ A6: Student RI Forms accessible: forms count = ${formsDataA.forms?.length}`);
  console.log('>>> [FLOW A] PASSED: LTC + RI sync, dual enrollment, faculty, and forms verified.\n');


  // ─────────────────────────────────────────────────────────────
  // 2. FLOW B: RI-ONLY BATCH & BULK UPLOAD WORKFLOW
  // ─────────────────────────────────────────────────────────────
  console.log('--- [FLOW B] Starting RI-Only Direct Flow ---');

  // B1. Create RI Direct Batch via controller
  const riDirectName = `RI BATCH RI-ONLY-${testSuffix}`;
  const riDirectCode = `RI-ONLY-${testSuffix}`;
  let createdBatchData = null;
  const createMock = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(d) { createdBatchData = d; }
  };

  await riController.createRiBatch({
    body: {
      name: riDirectName,
      batch_code: riDirectCode,
      start_date: '2026-10-05',
      end_date: '2026-10-20',
      description: 'RI Direct Immersion Cohort'
    }
  }, createMock);

  if (createMock.statusCode !== 201 || !createdBatchData?.batch) {
    throw new Error(`Failed to create RI Direct Batch: ${JSON.stringify(createdBatchData)}`);
  }
  const riDirectBatch = createdBatchData.batch;
  console.log(`✓ B1: Created RI Direct Batch "${riDirectBatch.name}" (ID: ${riDirectBatch.id}, Code: ${riDirectBatch.batch_code})`);
  console.log(`✓ B1 verification: source_program = "${riDirectBatch.source_program}", source_batch_id = ${riDirectBatch.source_batch_id}`);
  if (riDirectBatch.source_program !== 'RI_DIRECT') {
    throw new Error(`Expected source_program to be RI_DIRECT, got ${riDirectBatch.source_program}`);
  }
  if (riDirectBatch.source_batch_id !== null) {
    throw new Error(`Expected source_batch_id to be NULL, got ${riDirectBatch.source_batch_id}`);
  }

  // B2. RI Bulk Upload Students into RI_DIRECT Batch
  const riOnlyPrn = `PRN-B-${testSuffix}`;
  const riOnlyEmail = `ri.only.${testSuffix}@example.com`;
  const uploadRows = [
    {
      prn: riOnlyPrn,
      name: `RI Direct Student ${testSuffix}`,
      email: riOnlyEmail,
      panel: 'Panel 1',
      mobile: '9876543210',
      department: 'Mechanical Engineering',
      division: 'M1'
    }
  ];

  let uploadResultData = null;
  const uploadMock = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(d) { uploadResultData = d; }
  };

  await riController.bulkUploadStudents({
    params: { id: riDirectBatch.id },
    body: { students: uploadRows }
  }, uploadMock);

  console.log(`✓ B2: Bulk uploaded student. Imported count = ${uploadResultData?.imported_count}`);
  if (uploadResultData?.imported_count !== 1) {
    throw new Error(`Expected 1 student imported, got ${uploadResultData?.imported_count}`);
  }

  // Fetch the created user
  const riUserRes = await pool.query(`SELECT id, name, email, prn FROM users WHERE prn = $1`, [riOnlyPrn]);
  if (riUserRes.rowCount === 0) throw new Error('RI student user record not found in users table!');
  const riStudentUser = riUserRes.rows[0];

  // B3. Verify Student Record in ri_batch_students & Strict LTC Isolation
  const riEnrollmentRes = await pool.query(
    `SELECT * FROM ri_batch_students WHERE ri_batch_id = $1 AND student_id = $2`,
    [riDirectBatch.id, riStudentUser.id]
  );
  if (riEnrollmentRes.rowCount === 0) throw new Error('RI student enrollment not found in ri_batch_students!');
  const riEnrollment = riEnrollmentRes.rows[0];
  console.log(`✓ B3: Student in ri_batch_students: source_program = "${riEnrollment.source_program}", enrollment_type = "${riEnrollment.enrollment_type}", source_ltc_batch_id = ${riEnrollment.source_ltc_batch_id}`);
  if (riEnrollment.source_program !== 'RI_DIRECT') {
    throw new Error(`Expected source_program to be RI_DIRECT, got ${riEnrollment.source_program}`);
  }
  if (riEnrollment.source_ltc_batch_id !== null) {
    throw new Error(`Expected source_ltc_batch_id to be NULL, got ${riEnrollment.source_ltc_batch_id}`);
  }

  // CRITICAL CHECK: Verify student is NOT in batch_students (LTC table)
  const ltcEnrollmentCheck = await pool.query(
    `SELECT * FROM batch_students WHERE student_id = $1`,
    [riStudentUser.id]
  );
  console.log(`✓ B3 LTC Isolation check: LTC batch_students count = ${ltcEnrollmentCheck.rowCount}`);
  if (ltcEnrollmentCheck.rowCount > 0) {
    throw new Error('Flow B CRITICAL FAILURE: RI Direct student MUST NOT be in batch_students (LTC)!');
  }

  // B4. Assign Panel -> Village -> Faculty in RI Direct Batch
  const panelBRes = await pool.query(
    `SELECT id, name, panel_number FROM ri_panels WHERE ri_batch_id = $1 LIMIT 1`,
    [riDirectBatch.id]
  );
  if (panelBRes.rowCount === 0) throw new Error('Panel not auto-created during student upload!');
  const panelB = panelBRes.rows[0];

  // Create village for RI Direct batch
  const villageBRes = await pool.query(`
    INSERT INTO ri_villages (ri_batch_id, name, location, district)
    VALUES ($1, $2, 'Village Location B', 'District B')
    RETURNING id, name
  `, [riDirectBatch.id, `Village B ${testSuffix}`]);
  const villageB = villageBRes.rows[0];

  // Assign village to panel
  await pool.query(`UPDATE ri_panels SET ri_village_id = $1 WHERE id = $2`, [villageB.id, panelB.id]);

  // Create Faculty and assign to panel in RI Direct batch
  const facultyEmailB = `faculty.b.${testSuffix}@example.com`;
  await pool.query(`
    INSERT INTO ri_batch_faculty (ri_batch_id, ri_panel_id, name, email, role, status)
    VALUES ($1, $2, 'Faculty Mentor B', $3, 'Mentor', 'active')
  `, [riDirectBatch.id, panelB.id, facultyEmailB]);
  console.log(`✓ B4: Configured RI Direct Batch: Panel ${panelB.id} -> Village "${villageB.name}" -> Faculty "${facultyEmailB}"`);

  // Faculty sees students query check
  const facultyStudentsCheck = await pool.query(`
    SELECT rbs.student_id, u.name, u.prn, u.email, rp.name as panel_name, rv.name as village_name
    FROM ri_batch_students rbs
    JOIN users u ON rbs.student_id = u.id
    JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
    LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
    WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
  `, [riDirectBatch.id, panelB.id]);
  console.log(`✓ B4 Faculty visibility: Faculty query returned ${facultyStudentsCheck.rowCount} students in panel`);
  if (facultyStudentsCheck.rowCount === 0) {
    throw new Error('Flow B failure: Faculty could not see students in assigned panel!');
  }

  // B5. RI-Only Student Login Verification
  // The bulk upload sets initial password to 'student123'
  const studentLoginMockB = {
    user: null,
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.user = d.user; }
  };
  await authController.login({ body: { email: riOnlyEmail, password: 'student123' } }, studentLoginMockB);
  console.log(`✓ B5: RI-only Student logged in:`);
  console.log(`   - has_ltc = ${studentLoginMockB.user?.programs?.has_ltc}`);
  console.log(`   - has_ri = ${studentLoginMockB.user?.programs?.has_ri}`);
  console.log(`   - ri_batch = "${studentLoginMockB.user?.programs?.ri_batch?.batch_name}"`);
  console.log(`   - ltc_batch = ${JSON.stringify(studentLoginMockB.user?.programs?.ltc_batch)}`);

  if (studentLoginMockB.user?.programs?.has_ltc !== false) {
    throw new Error('Flow B CRITICAL FAILURE: RI Direct student MUST have has_ltc = false!');
  }
  if (studentLoginMockB.user?.programs?.has_ri !== true) {
    throw new Error('Flow B CRITICAL FAILURE: RI Direct student MUST have has_ri = true!');
  }

  // B6. RI Forms Check for RI-only Student
  let formsDataB = null;
  const formsMockB = {
    status(c) { return this; },
    json(d) { formsDataB = d; }
  };
  await riStudentController.getStudentFormsHub({ user: { id: riStudentUser.id } }, formsMockB);
  if (!formsDataB || formsDataB.message?.includes('No active Rural Immersion')) {
    throw new Error('Flow B failure: RI-only student could not access RI forms!');
  }
  console.log(`✓ B6: RI-only Student RI Forms accessible: forms count = ${formsDataB.forms?.length}`);
  console.log('>>> [FLOW B] PASSED: RI Direct batch, student isolation, faculty, and forms verified.\n');

  // ─────────────────────────────────────────────────────────────
  // 3. GET RI BATCHES API (Dropdown & Badges Verification)
  // ─────────────────────────────────────────────────────────────
  console.log('--- [API Check] Verifying GET /api/ri/batches for UI Dropdown & Badges ---');
  let batchesApiResponse = null;
  const getBatchesMock = {
    json(d) { batchesApiResponse = d; }
  };
  await riController.getRiBatches({}, getBatchesMock);
  const returnedBatches = batchesApiResponse?.batches || [];

  const foundLtcBatch = returnedBatches.find(b => b.id === syncedRiBatch.id);
  const foundRiBatch = returnedBatches.find(b => b.id === riDirectBatch.id);

  console.log(`Found LTC Synced Batch in API: "${foundLtcBatch?.name}" (source: ${foundLtcBatch?.source_program}, code: ${foundLtcBatch?.batch_code})`);
  console.log(`Found RI Direct Batch in API:   "${foundRiBatch?.name}" (source: ${foundRiBatch?.source_program}, code: ${foundRiBatch?.batch_code})`);

  if (!foundLtcBatch || foundLtcBatch.source_program !== 'LTC_SYNC') {
    throw new Error(`Expected LTC synced batch to have source_program='LTC_SYNC', got ${foundLtcBatch?.source_program}`);
  }
  if (!foundRiBatch || foundRiBatch.source_program !== 'RI_DIRECT') {
    throw new Error(`Expected RI direct batch to have source_program='RI_DIRECT', got ${foundRiBatch?.source_program}`);
  }
  console.log('✓ API Check: Both LTC_SYNC and RI_DIRECT cohorts returned with correct metadata.');

  // ─────────────────────────────────────────────────────────────
  // CLEANUP TEST DATA
  // ─────────────────────────────────────────────────────────────
  console.log('\nCleaning up verification records...');
  await pool.query(`DELETE FROM batches WHERE id = $1`, [ltcBatch.id]);
  await pool.query(`DELETE FROM ri_batches WHERE id IN ($1, $2)`, [syncedRiBatch.id, riDirectBatch.id]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [ltcStudent.id, riStudentUser.id]);
  console.log('✓ Cleanup completed.');

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ VERIFICATION ERROR:', err);
    process.exit(1);
  });
