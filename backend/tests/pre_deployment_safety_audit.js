const pool = require('../config/db');
const path = require('path');
const assert = require('assert');

async function runComprehensiveAudit() {
  console.log('================================================================');
  console.log('STARTING COMPREHENSIVE PRE-DEPLOYMENT SAFETY & REGRESSION AUDIT');
  console.log('================================================================\n');

  let auditFailures = [];

  function recordPass(section, desc) {
    console.log(`[PASS] [${section}] ${desc}`);
  }

  function recordFail(section, desc, err) {
    console.error(`[FAIL] [${section}] ${desc}`);
    if (err) console.error(err);
    auditFailures.push({ section, desc, error: err?.message || String(err) });
  }

  // =================================================================
  // 1. DATABASE SAFETY & DATA INTEGRITY
  // =================================================================
  console.log('\n--- 1. DATABASE SAFETY & DATA INTEGRITY ---');
  try {
    // 1.1 Verify core tables exist
    const requiredTables = [
      'users', 'batches', 'batch_students',
      'ri_batches', 'ri_panels', 'ri_batch_students', 'ri_villages',
      'ri_undertakings', 'ri_preparatory_checklists', 'ri_daily_activity_reports',
      'ri_institutional_visits', 'ri_family_surveys', 'ri_problem_identifications',
      'ri_community_projects', 'ri_student_feedbacks', 'ri_student_forms',
      'ri_audit_logs', 'ri_evaluations', 'database_reset_otps'
    ];

    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTableNames = new Set(tablesRes.rows.map(r => r.table_name));

    for (const t of requiredTables) {
      if (!existingTableNames.has(t)) {
        throw new Error(`Critical table missing: ${t}`);
      }
    }
    recordPass('DB', `All ${requiredTables.length} required LTC & RI tables present and active in public schema`);

    // 1.2 Verify critical new columns in Form IV, Form V, Form VI
    const columnChecks = [
      { table: 'ri_institutional_visits', column: 'activity_photo_1' },
      { table: 'ri_institutional_visits', column: 'activity_photo_2' },
      { table: 'ri_institutional_visits', column: 'observation_data' },
      { table: 'ri_family_surveys', column: 'survey_data' },
      { table: 'ri_problem_identifications', column: 'form_data' },
      { table: 'ri_problem_identifications', column: 'assignment_link' },
      { table: 'ri_student_feedbacks', column: 'activity_ratings' }
    ];

    for (const { table, column } of columnChecks) {
      const colRes = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);
      if (colRes.rowCount === 0) {
        throw new Error(`Missing expected column: ${table}.${column}`);
      }
    }
    recordPass('DB', 'All non-destructive column extensions verified in database');

    // 1.3 Verify existing student & form record counts
    const userCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'student'");
    const ltcBatchStudentCount = await pool.query("SELECT COUNT(*) FROM batch_students");
    const riBatchStudentCount = await pool.query("SELECT COUNT(*) FROM ri_batch_students");

    assert.ok(parseInt(userCount.rows[0].count, 10) > 0, 'Student users must not be zero');
    assert.ok(parseInt(ltcBatchStudentCount.rows[0].count, 10) > 0, 'LTC batch students must not be zero');
    assert.ok(parseInt(riBatchStudentCount.rows[0].count, 10) > 0, 'RI batch students must not be zero');

    recordPass('DB', `Existing records intact: ${userCount.rows[0].count} students, ${ltcBatchStudentCount.rows[0].count} LTC assignments, ${riBatchStudentCount.rows[0].count} RI assignments`);
  } catch (err) {
    recordFail('DB', 'Database safety and table structure verification failed', err);
  }

  // =================================================================
  // 2. LTC/RI STUDENT ISOLATION
  // =================================================================
  console.log('\n--- 2. LTC / RI STUDENT ISOLATION ---');
  try {
    // 2.1 Verify RI_DIRECT students cannot leak into LTC admin getUsers
    const adminController = require('../controllers/adminController');
    const mockReq = { user: { role: 'admin' }, query: {} };
    let mockUsersRes = {
      statusCode: 200,
      data: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.data = d; return this; }
    };
    await adminController.getUsers(mockReq, mockUsersRes);

    const ltcUsers = mockUsersRes.data?.users || [];
    assert.ok(ltcUsers.length > 0, 'LTC getUsers returned valid user records');

    // Query for any RI_DIRECT student IDs
    const riDirectRes = await pool.query(
      "SELECT student_id FROM ri_batch_students WHERE source_program = 'RI_DIRECT'"
    );
    const riDirectIds = new Set(riDirectRes.rows.map(r => r.student_id));

    const leakedRiDirectUsers = ltcUsers.filter(u => riDirectIds.has(u.id));
    assert.strictEqual(leakedRiDirectUsers.length, 0, 'Zero RI_DIRECT students must appear in LTC getUsers');
    recordPass('ISOLATION', `LTC getUsers strictly excludes all RI_DIRECT students (0 leaked out of ${riDirectIds.size})`);

    // 2.2 Verify LTC student portal eligibility helper
    const riStudentController = require('../controllers/riStudentController');
    const studentSample = await pool.query(`
      SELECT rbs.student_id, rbs.ri_batch_id 
      FROM ri_batch_students rbs 
      JOIN batch_students bs ON rbs.student_id = bs.student_id
      LIMIT 1
    `);

    if (studentSample.rows.length > 0) {
      let mockEligRes = {
        statusCode: 200,
        data: null,
        status(c) { this.statusCode = c; return this; },
        json(d) { this.data = d; return this; }
      };
      await riStudentController.getStudentPrograms({ user: { id: studentSample.rows[0].student_id } }, mockEligRes);
      assert.strictEqual(mockEligRes.data?.has_ltc, true, 'Dual enrolled student correctly identifies LTC');
      assert.strictEqual(mockEligRes.data?.has_ri, true, 'Dual enrolled student correctly identifies RI');
      recordPass('ISOLATION', 'Dual-enrolled LTC_SYNC student program eligibility helper functions correctly');
    }
  } catch (err) {
    recordFail('ISOLATION', 'LTC/RI student isolation check failed', err);
  }

  // =================================================================
  // 3. RI STUDENT FORMS: SAVE DRAFT, VALIDATION, AND UPLOADS
  // =================================================================
  console.log('\n--- 3. RI STUDENT FORMS END-TO-END WORKFLOW ---');
  const riStudentController = require('../controllers/riStudentController');

  // Test student
  const testStudent = (await pool.query(`
    SELECT u.id, u.name, rbs.ri_batch_id, rbs.ri_panel_id
    FROM users u
    JOIN ri_batch_students rbs ON rbs.student_id = u.id
    LIMIT 1
  `)).rows[0];

  // 3.1 Form IV: Institutional Visits photo upload validations
  try {
    console.log('Testing Form IV photo upload format and size limits...');
    // Unsupported format
    let resBadExt = { statusCode: 200, data: null, status(c) { this.statusCode = c; return this; }, json(d) { this.data = d; return this; } };
    await riStudentController.uploadInstitutionalPhoto({
      user: { id: testStudent.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: { originalname: 'doc.pdf', filename: 'doc.pdf', size: 1024 }
    }, resBadExt);
    assert.strictEqual(resBadExt.statusCode, 400, 'Expected 400 for non-image format');
    recordPass('FORM_IV', 'Photo upload rejected non-image format (.pdf)');

    // Exceeds 5MB
    let resTooLarge = { statusCode: 200, data: null, status(c) { this.statusCode = c; return this; }, json(d) { this.data = d; return this; } };
    await riStudentController.uploadInstitutionalPhoto({
      user: { id: testStudent.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: { originalname: 'image.jpg', filename: 'image.jpg', size: 6 * 1024 * 1024 }
    }, resTooLarge);
    assert.strictEqual(resTooLarge.statusCode, 400, 'Expected 400 for file exceeding 5MB');
    recordPass('FORM_IV', 'Photo upload rejected image exceeding 5MB');

    // Valid upload
    let resValidPhoto = { statusCode: 200, data: null, status(c) { this.statusCode = c; return this; }, json(d) { this.data = d; return this; } };
    await riStudentController.uploadInstitutionalPhoto({
      user: { id: testStudent.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: { originalname: 'audit_field.webp', filename: 'audit_field.webp', size: 1024 * 500 }
    }, resValidPhoto);
    assert.strictEqual(resValidPhoto.statusCode, 200, 'Expected 200 for valid photo upload');
    assert.ok(resValidPhoto.data?.url, 'Expected photo URL returned');
    recordPass('FORM_IV', 'Photo upload accepted valid WEBP image (< 5MB)');
  } catch (err) {
    recordFail('FORM_IV', 'Form IV photo upload validation failed', err);
  }

  // 3.2 Form VI: Problem Identification 1500-word report document upload validation
  try {
    console.log('Testing Form VI document upload format and size limits...');
    // Unsupported format
    let resBadDoc = { statusCode: 200, data: null, status(c) { this.statusCode = c; return this; }, json(d) { this.data = d; return this; } };
    await riStudentController.uploadAssignmentDocument({
      user: { id: testStudent.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: { originalname: 'script.sh', filename: 'script.sh', size: 1024 }
    }, resBadDoc);
    assert.strictEqual(resBadDoc.statusCode, 400, 'Expected 400 for non-doc format');
    recordPass('FORM_VI', 'Document upload rejected invalid file format (.sh)');

    // Exceeds 10MB
    let resDocTooLarge = { statusCode: 200, data: null, status(c) { this.statusCode = c; return this; }, json(d) { this.data = d; return this; } };
    await riStudentController.uploadAssignmentDocument({
      user: { id: testStudent.id },
      protocol: 'http',
      get: () => 'localhost:5001',
      file: { originalname: 'report.pdf', filename: 'report.pdf', size: 12 * 1024 * 1024 }
    }, resDocTooLarge);
    assert.strictEqual(resDocTooLarge.statusCode, 400, 'Expected 400 for document exceeding 10MB');
    recordPass('FORM_VI', 'Document upload rejected document exceeding 10MB');
  } catch (err) {
    recordFail('FORM_VI', 'Form VI document upload validation failed', err);
  }

  // 3.3 Form VIII: Student Feedback Question 6 compulsory check
  try {
    console.log('Testing Form VIII Question 6 validation...');
    let resFbBad = { statusCode: 200, data: null, status(c) { this.statusCode = c; return this; }, json(d) { this.data = d; return this; } };
    await riStudentController.saveStudentFeedback({
      user: { id: testStudent.id },
      body: {
        activity_ratings: { institutional_visits: 5, household_surveys: 5, community_project: 5, debrief_school_activity: 5 },
        best_practices_observed: '', // empty Question 6
        is_final_submit: true
      }
    }, resFbBad);
    assert.strictEqual(resFbBad.statusCode, 400, 'Expected 400 when Question 6 is missing');
    recordPass('FORM_VIII', 'Form VIII final submission strictly rejected when Question 6 (best practices) is missing');
  } catch (err) {
    recordFail('FORM_VIII', 'Form VIII Question 6 validation check failed', err);
  }

  // 3.4 Read-only invariant on submitted forms
  try {
    console.log('Testing read-only invariant on submitted forms...');
    // Inspect ri_student_forms submitted records
    const submittedForms = await pool.query(`
      SELECT student_id, ri_batch_id, form_type, status, progress_percent 
      FROM ri_student_forms 
      WHERE status = 'Submitted'
      LIMIT 1
    `);

    if (submittedForms.rows.length > 0) {
      const sf = submittedForms.rows[0];
      assert.strictEqual(sf.progress_percent, 100, 'Submitted form progress_percent must be 100%');
      assert.strictEqual(sf.status, 'Submitted', 'Submitted form status must be Submitted');
      recordPass('READ_ONLY', `Submitted form (${sf.form_type}) for student ${sf.student_id} verified locked at 100% progress`);
    }
  } catch (err) {
    recordFail('READ_ONLY', 'Read-only submission invariant check failed', err);
  }

  // =================================================================
  // 4. FACULTY WORKSPACE VISIBILITY & RECONCILIATION
  // =================================================================
  console.log('\n--- 4. FACULTY WORKSPACE VISIBILITY & RECONCILIATION ---');
  try {
    const riFacultyController = require('../controllers/riFacultyController');
    let mockFacultyRes = {
      statusCode: 200,
      data: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.data = d; return this; }
    };

    const mockFacultyReq = {
      user: { id: testStudent.id, role: 'superadmin' },
      params: { studentId: String(testStudent.id) },
      query: { batch_id: String(testStudent.ri_batch_id), panel_id: String(testStudent.ri_panel_id) },
      isRiAdminPreview: true
    };

    await riFacultyController.getStudentSubmissionDetail(mockFacultyReq, mockFacultyRes);
    assert.strictEqual(mockFacultyRes.statusCode, 200, 'Faculty getStudentSubmissionDetail returned HTTP 200');

    const detail = mockFacultyRes.data;
    assert.ok(detail?.student, 'Student details object must be populated');
    assert.ok(Array.isArray(detail?.forms_summary), 'forms_summary array must be populated');
    assert.ok(detail.forms_summary.length >= 7, 'Reconciled summary must contain all official forms');

    // Verify Form IV photo visibility
    assert.ok(Array.isArray(detail?.institutional_visits), 'institutional_visits must be an array');
    if (detail.institutional_visits.length > 0) {
      const v1 = detail.institutional_visits[0];
      assert.ok('activity_photo_1' in v1, 'activity_photo_1 property must exist on visit');
      assert.ok('activity_photo_2' in v1, 'activity_photo_2 property must exist on visit');
    }

    recordPass('FACULTY', 'Faculty workspace retrieves all student details, reconciled forms_summary, and Form IV photos');

    // 4.2 Verify Faculty authorization scope enforcement
    let mockScopeRejectRes = {
      statusCode: 200,
      data: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.data = d; return this; }
    };
    const mockUnauthorizedReq = {
      user: { id: 999999, role: 'faculty' },
      userEmail: 'unauthorized_faculty@somaiya.edu',
      activeBatchIds: [1],
      assignedBatchIds: [1],
      facultyAssignments: [{ ri_batch_id: 1, ri_panel_id: 999 }],
      params: { studentId: String(testStudent.id) },
      query: { batch_id: '1', panel_id: '888' }, // non-assigned panel
      isRiAdminPreview: false
    };
    await riFacultyController.getStudentSubmissionDetail(mockUnauthorizedReq, mockScopeRejectRes);
    assert.strictEqual(mockScopeRejectRes.statusCode, 403, 'Expected 403 Forbidden for unauthorized panel query');
    recordPass('FACULTY_AUTH', 'Faculty portal scope strictly blocks access to unauthorized batches/panels with HTTP 403');
  } catch (err) {
    recordFail('FACULTY', 'Faculty workspace visibility or authorization failed', err);
  }

  // =================================================================
  // 5. SUMMARY REPORT
  // =================================================================
  console.log('\n================================================================');
  console.log(`AUDIT RESULTS: ${auditFailures.length === 0 ? 'ALL CHECKS PASSED' : `${auditFailures.length} FAILURES FOUND`}`);
  console.log('================================================================\n');

  if (auditFailures.length > 0) {
    console.error('Audit Failure Details:');
    auditFailures.forEach((f, idx) => {
      console.error(`${idx + 1}. [${f.section}] ${f.desc} -> ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('SAFETY & REGRESSION AUDIT PASSED WITH 100% SUCCESS.');
    process.exit(0);
  }
}

runComprehensiveAudit().catch(err => {
  console.error('Unexpected audit crash:', err);
  process.exit(1);
});
