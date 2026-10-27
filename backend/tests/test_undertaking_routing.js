require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../config/db');
const studentController = require('../controllers/studentController');
const riStudentController = require('../controllers/riStudentController');
const bcrypt = require('bcryptjs');

async function runUndertakingTests() {
  console.log('====================================================');
  console.log('Testing Student Undertaking Logic for RI and LTC+RI');
  console.log('====================================================');

  const suffix = Date.now();
  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Create a Test LTC Batch
  const ltcBatchRes = await pool.query(`
    INSERT INTO batches (name, year, start_date, end_date, status, is_deleted)
    VALUES ($1, '2026', '2026-10-01', '2026-10-10', 'active', false)
    RETURNING id, name
  `, [`LTC Undertaking Batch ${suffix}`]);
  const ltcBatch = ltcBatchRes.rows[0];

  // 2. Create a Test RI Batch
  const riBatchRes = await pool.query(`
    INSERT INTO ri_batches (name, batch_code, status, source_program, source_batch_id)
    VALUES ($1, $2, 'active', 'RI_DIRECT', NULL)
    RETURNING id, name, batch_code
  `, [`RI Undertaking Direct Batch ${suffix}`, `RI-UND-${suffix}`]);
  const riBatch = riBatchRes.rows[0];

  // 3. Create a Test Village & Panel in RI
  const vilRes = await pool.query(`
    INSERT INTO ri_villages (ri_batch_id, name, location, taluka, district, status)
    VALUES ($1, $2, 'Test Loc', 'Daund', 'Pune', 'Active')
    RETURNING id
  `, [riBatch.id, `Test Village ${suffix}`]);
  const villageId = vilRes.rows[0].id;

  const panelRes = await pool.query(`
    INSERT INTO ri_panels (ri_batch_id, panel_number, name, ri_village_id)
    VALUES ($1, 1, 'Panel 1', $2)
    RETURNING id
  `, [riBatch.id, villageId]);
  const panelId = panelRes.rows[0].id;

  // 4. Create Student 1: RI-ONLY STUDENT
  const riOnlyUserRes = await pool.query(`
    INSERT INTO users (name, email, password, role, prn, roll_number, department, division, status)
    VALUES ($1, $2, $3, 'student', $4, 'R101', 'Computer Engineering', 'A', 'active')
    RETURNING id, name, email, prn
  `, [`RI Only Student ${suffix}`, `ri.only.${suffix}@example.com`, passwordHash, `PRN-RO-${suffix}`]);
  const riOnlyStudent = riOnlyUserRes.rows[0];

  // Enroll in RI batch
  await pool.query(`
    INSERT INTO ri_batch_students (ri_batch_id, ri_panel_id, student_id, source_program)
    VALUES ($1, $2, $3, 'RI_DIRECT')
  `, [riBatch.id, panelId, riOnlyStudent.id]);

  // 5. Create Student 2: RI + LTC STUDENT
  const dualUserRes = await pool.query(`
    INSERT INTO users (name, email, password, role, prn, roll_number, department, division, status)
    VALUES ($1, $2, $3, 'student', $4, 'D101', 'Mechanical Engineering', 'B', 'active')
    RETURNING id, name, email, prn
  `, [`Dual LTC+RI Student ${suffix}`, `dual.${suffix}@example.com`, passwordHash, `PRN-DUAL-${suffix}`]);
  const dualStudent = dualUserRes.rows[0];

  // Enroll in LTC batch_students
  await pool.query(`
    INSERT INTO batch_students (batch_id, student_id, squad, room)
    VALUES ($1, $2, 'Surya', 'R-101')
  `, [ltcBatch.id, dualStudent.id]);

  // Enroll in RI batch_students
  await pool.query(`
    INSERT INTO ri_batch_students (ri_batch_id, ri_panel_id, student_id, source_program, source_ltc_batch_id)
    VALUES ($1, $2, $3, 'LTC_SYNC', $4)
  `, [riBatch.id, panelId, dualStudent.id, ltcBatch.id]);

  console.log('\n--- TEST CASE 1: RI-ONLY STUDENT WORKFLOW ---');
  // Check profile
  let riOnlyProfile = null;
  await riStudentController.getStudentProfile(
    { user: { id: riOnlyStudent.id, email: riOnlyStudent.email, name: riOnlyStudent.name, role: 'student' } },
    { json: (d) => { riOnlyProfile = d; }, status: () => ({ json: (d) => { riOnlyProfile = d; } }) }
  );
  console.log(`✓ RI-only student profile: has_ltc = ${riOnlyProfile.has_ltc}, undertaking_submitted = ${riOnlyProfile.undertaking_status.submitted}`);
  if (riOnlyProfile.has_ltc !== false) {
    throw new Error(`Expected has_ltc = false for RI-only student, got ${riOnlyProfile.has_ltc}`);
  }
  if (riOnlyProfile.undertaking_status.submitted !== false) {
    throw new Error(`Expected undertaking submitted = false initially`);
  }

  // Submit RI undertaking
  let riSubmitData = null;
  await riStudentController.submitStudentUndertaking(
    {
      user: { id: riOnlyStudent.id, email: riOnlyStudent.email, name: riOnlyStudent.name, role: 'student' },
      body: {
        signedName: riOnlyStudent.name,
        emergencyContactName: 'John Parent',
        emergencyContactRelation: 'Father',
        emergencyContactMobile: '9876543210',
        bloodGroup: 'O+',
        consentFieldWork: true,
        consentCodeOfConduct: true
      },
      headers: {},
      socket: {}
    },
    { json: (d) => { riSubmitData = d; }, status: () => ({ json: (d) => { riSubmitData = d; } }) }
  );
  console.log(`✓ RI-only student submitted RI undertaking: success = ${riSubmitData?.success}`);
  if (!riSubmitData?.success) {
    throw new Error(`Failed to submit RI undertaking for RI-only student: ${JSON.stringify(riSubmitData)}`);
  }

  // Verify stored in ri_undertakings
  const riUnderCheck = await pool.query(`SELECT * FROM ri_undertakings WHERE student_id = $1`, [riOnlyStudent.id]);
  if (riUnderCheck.rowCount !== 1) {
    throw new Error(`Expected 1 record in ri_undertakings for RI-only student, got ${riUnderCheck.rowCount}`);
  }
  console.log(`✓ Verified 1 record in ri_undertakings table for RI-only student`);

  console.log('\n--- TEST CASE 2: RI + LTC STUDENT WORKFLOW ---');
  // Check initial profile for dual student
  let dualProfile = null;
  await riStudentController.getStudentProfile(
    { user: { id: dualStudent.id, email: dualStudent.email, name: dualStudent.name, role: 'student' } },
    { json: (d) => { dualProfile = d; }, status: () => ({ json: (d) => { dualProfile = d; } }) }
  );
  console.log(`✓ Dual student profile: has_ltc = ${dualProfile.has_ltc}, undertaking_submitted = ${dualProfile.undertaking_status.submitted}`);
  if (dualProfile.has_ltc !== true) {
    throw new Error(`Expected has_ltc = true for dual student, got ${dualProfile.has_ltc}`);
  }

  // Dual student submits LTC Undertaking via studentController.submitUndertaking
  let ltcSubmitData = null;
  await studentController.submitUndertaking(
    {
      user: { id: dualStudent.id, email: dualStudent.email, name: dualStudent.name, role: 'student' },
      body: {
        signedName: dualStudent.name,
        signedDate: '2026-10-02',
        emergencyContactName: 'Jane Parent',
        emergencyContactRelation: 'Mother',
        emergencyContactMobile: '9123456780',
        emergencyContactEmail: 'mother@example.com',
        bloodGroup: 'B+',
        medicalConditions: 'None',
        knownAllergies: 'None',
        currentMedication: 'None',
        dietaryRestrictions: 'None',
        consentMedia: true,
        consentData: true,
        consentChecks: true,
        consentMedical: true,
        consentDosDonts: true,
        tshirtSize: 'L',
        jainFood: 'No',
        mondayFast: 'No'
      }
    },
    { json: (d) => { ltcSubmitData = d; }, status: () => ({ json: (d) => { ltcSubmitData = d; } }) }
  );
  console.log(`✓ Dual student submitted LTC Undertaking: message = "${ltcSubmitData?.message}"`);
  if (!ltcSubmitData?.message || !ltcSubmitData.message.includes('successfully')) {
    throw new Error(`Failed to submit LTC undertaking for dual student: ${JSON.stringify(ltcSubmitData)}`);
  }

  // Verify single record in users table, NO duplicate in ri_undertakings
  const usersCheck = await pool.query(`SELECT undertaking_submitted, undertaking_signed_name, blood_group FROM users WHERE id = $1`, [dualStudent.id]);
  if (!usersCheck.rows[0].undertaking_submitted) {
    throw new Error(`Expected users.undertaking_submitted to be true`);
  }
  const dualRiUnderCheck = await pool.query(`SELECT * FROM ri_undertakings WHERE student_id = $1`, [dualStudent.id]);
  console.log(`✓ Dual student records in ri_undertakings table: ${dualRiUnderCheck.rowCount} (0 expected, no duplicate created)`);
  if (dualRiUnderCheck.rowCount !== 0) {
    throw new Error(`Expected 0 duplicate records in ri_undertakings for dual student, got ${dualRiUnderCheck.rowCount}`);
  }

  // Test RI Student Profile now sees undertaking submitted
  let dualProfileAfter = null;
  await riStudentController.getStudentProfile(
    { user: { id: dualStudent.id, email: dualStudent.email, name: dualStudent.name, role: 'student' } },
    { json: (d) => { dualProfileAfter = d; }, status: () => ({ json: (d) => { dualProfileAfter = d; } }) }
  );
  console.log(`✓ RI Profile undertaking_status after LTC submission: submitted = ${dualProfileAfter.undertaking_status.submitted}`);
  if (dualProfileAfter.undertaking_status.submitted !== true) {
    throw new Error(`Expected RI profile undertaking_status.submitted = true for dual student`);
  }

  // Test RI Student Undertaking API returns unified data
  let dualUndertakingData = null;
  await riStudentController.getStudentUndertaking(
    { user: { id: dualStudent.id, email: dualStudent.email, name: dualStudent.name, role: 'student' } },
    { json: (d) => { dualUndertakingData = d; }, status: () => ({ json: (d) => { dualUndertakingData = d; } }) }
  );
  console.log(`✓ RI getStudentUndertaking: submitted = ${dualUndertakingData.submitted}, signed_name = "${dualUndertakingData.undertaking?.signed_name}", blood_group = "${dualUndertakingData.undertaking?.blood_group}"`);
  if (!dualUndertakingData.submitted || dualUndertakingData.undertaking?.signed_name !== dualStudent.name) {
    throw new Error(`Expected getStudentUndertaking to return unified LTC undertaking data`);
  }

  // Test RI Forms Hub returns FORM IA as submitted
  let formsHubData = null;
  await riStudentController.getStudentFormsHub(
    { user: { id: dualStudent.id, email: dualStudent.email, name: dualStudent.name, role: 'student' } },
    { json: (d) => { formsHubData = d; }, status: () => ({ json: (d) => { formsHubData = d; } }) }
  );
  const undertakingFormStatus = formsHubData.forms.find(f => f.form_type === 'UNDERTAKING');
  console.log(`✓ RI Forms Hub Form IA status: ${undertakingFormStatus?.status}`);
  if (undertakingFormStatus?.status !== 'Submitted') {
    throw new Error(`Expected Forms Hub Form IA status to be 'Submitted', got ${undertakingFormStatus?.status}`);
  }

  // Clean up test records
  await pool.query(`DELETE FROM ri_undertakings WHERE student_id = $1`, [riOnlyStudent.id]);
  await pool.query(`DELETE FROM ri_batch_students WHERE student_id IN ($1, $2)`, [riOnlyStudent.id, dualStudent.id]);
  await pool.query(`DELETE FROM batch_students WHERE student_id = $1`, [dualStudent.id]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [riOnlyStudent.id, dualStudent.id]);
  await pool.query(`DELETE FROM ri_panels WHERE id = $1`, [panelId]);
  await pool.query(`DELETE FROM ri_villages WHERE id = $1`, [villageId]);
  await pool.query(`DELETE FROM ri_batches WHERE id = $1`, [riBatch.id]);
  await pool.query(`DELETE FROM batches WHERE id = $1`, [ltcBatch.id]);

  console.log('\n====================================================');
  console.log('ALL UNDERTAKING INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
  process.exit(0);
}

runUndertakingTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
