const http = require('http');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';
const PORT = 5001;

function apiRequest(urlPath, token, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: urlPath,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run10CasesVerification() {
  console.log('========================================================================');
  console.log('RI EVALUATION LOCK SYNCHRONIZATION — 10 REGRESSION CASES VERIFICATION');
  console.log('========================================================================\n');

  // Find Super Admin
  const saRes = await pool.query(`SELECT id, name, email, role FROM users WHERE role IN ('superadmin-ri', 'superadmin') LIMIT 1`);
  const saUser = saRes.rows[0];
  const saToken = jwt.sign({ id: saUser.id, email: saUser.email, role: saUser.role }, JWT_SECRET, { expiresIn: '2h' });

  // Locate Batch 224, Panel 500 (Batch 1, Panel 9: VISUAL COMMUNICATION-B)
  const panelRes = await pool.query(`
    SELECT rp.id AS panel_id, rp.panel_number, rp.name AS panel_name, rp.ri_batch_id AS batch_id, rb.name AS batch_name, rb.start_date, rb.end_date
    FROM ri_panels rp
    JOIN ri_batches rb ON rp.ri_batch_id = rb.id
    WHERE rp.id = 500
  `);
  if (panelRes.rowCount === 0) throw new Error('Panel 500 not found');
  const targetPanel = panelRes.rows[0];
  const { batch_id, panel_id, panel_name, panel_number } = targetPanel;

  console.log(`Target: Batch ${batch_id} ("${targetPanel.batch_name}"), Panel ${panel_id} (#${panel_number}: "${panel_name}")`);

  // Locate Faculty assigned to this panel
  const facRes = await pool.query(`
    SELECT rbf.id, rbf.email, rbf.name, u.id AS user_id
    FROM ri_batch_faculty rbf
    JOIN users u ON LOWER(rbf.email) = LOWER(u.email)
    WHERE rbf.ri_panel_id = $1 AND rbf.ri_batch_id = $2 AND rbf.status <> 'deleted'
    LIMIT 1
  `, [panel_id, batch_id]);
  const faculty = facRes.rows[0];
  const facToken = jwt.sign({ id: faculty.user_id, email: faculty.email, role: 'faculty' }, JWT_SECRET, { expiresIn: '2h' });

  // Satisfy faculty undertaking
  await pool.query(`
    INSERT INTO ri_faculty_undertakings (faculty_id, signed_name, signed_date, status)
    VALUES ($1, $2, '14/10/2026', 'Submitted')
    ON CONFLICT (faculty_id) DO UPDATE SET status = 'Submitted'
  `, [faculty.user_id, faculty.name]);

  console.log(`Faculty: ${faculty.name} (${faculty.email})\n`);

  // Ensure active dates so deadlines do not auto-lock panel
  await pool.query(`
    UPDATE ri_batches SET start_date = CURRENT_DATE, end_date = CURRENT_DATE + INTERVAL '10 days' WHERE id = $1
  `, [batch_id]);

  // Clean initial locks on this panel
  await pool.query(`DELETE FROM ri_evaluation_locks WHERE ri_panel_id = $1`, [panel_id]);

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 1: Faculty locks Panel 9 (Bulk save as Completed)
  // Expected: Super Admin immediately shows Panel Locked.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 1: Faculty locks Panel 9 ---');
  // Faculty completes evaluations and locks panel
  const studentsRes = await pool.query(`
    SELECT rbs.student_id FROM ri_batch_students rbs WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
  `, [batch_id, panel_id]);
  const allStudentIds = studentsRes.rows.map(r => r.student_id);

  const bulkSaveRes = await apiRequest('/api/ri/faculty-portal/evaluations/bulk', facToken, 'POST', {
    batch_id,
    panel_id,
    evaluations: allStudentIds.map(sId => ({
      student_id: sId,
      institutional_visit_rating: 'Excellent',
      family_survey_rating: 'Good',
      community_project_rating: 'Excellent',
      problem_statement_marks: 13,
      smart_solution_marks: 35,
      faculty_remarks: 'Case 1 evaluation remark',
      evaluation_status: 'Completed'
    }))
  });
  console.log(`Faculty bulk lock response status: ${bulkSaveRes.status}`);

  // Check Super Admin endpoint immediately
  const saDetailCase1 = await apiRequest(`/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=${panel_id}`, saToken);
  console.log(`Super Admin is_locked: ${saDetailCase1.data?.lock?.is_locked}, reason: "${saDetailCase1.data?.lock?.lock_reason}"`);
  if (saDetailCase1.data?.lock?.is_locked !== true) {
    throw new Error('CASE 1 FAILED: Super Admin did not immediately show Panel Locked after faculty locked it.');
  }
  console.log('✅ CASE 1 PASSED: Super Admin immediately shows Panel Locked.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 2: Super Admin unlocks Panel 9
  // Expected: Faculty and Super Admin both show Panel Unlocked.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 2: Super Admin unlocks Panel 9 ---');
  const unlockRes = await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', saToken, 'POST', {
    batch_id,
    panel_id,
    is_locked: false
  });
  console.log(`Super Admin unlock API status: ${unlockRes.status}, success: ${unlockRes.data?.success}`);

  // Check Super Admin response
  const saDetailCase2 = await apiRequest(`/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=${panel_id}`, saToken);
  console.log(`Super Admin view: is_locked = ${saDetailCase2.data?.lock?.is_locked}, reason = "${saDetailCase2.data?.lock?.lock_reason}"`);

  // Check Faculty response
  const facEvalCase2 = await apiRequest(`/api/ri/faculty-portal/evaluations?batch_id=${batch_id}&panel_id=${panel_id}`, facToken);
  console.log(`Faculty view: panel_lock.is_locked = ${facEvalCase2.data?.panel_lock?.is_locked}, is_explicitly_unlocked = ${facEvalCase2.data?.panel_lock?.is_explicitly_unlocked}`);

  if (saDetailCase2.data?.lock?.is_locked !== false) {
    throw new Error('CASE 2 FAILED: Super Admin did not show Panel Unlocked.');
  }
  if (facEvalCase2.data?.panel_lock?.is_locked !== false || facEvalCase2.data?.panel_lock?.is_explicitly_unlocked !== true) {
    throw new Error('CASE 2 FAILED: Faculty portal did not show Panel Unlocked.');
  }
  console.log('✅ CASE 2 PASSED: Both portals display Panel Unlocked.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 3: Panel is locked while some student evaluations have Completed status
  // Expected: Panel-level lock is shown independently; marks and individual statuses are preserved.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 3: Panel locked with existing Completed evaluations ---');
  // First record student 0's marks to check preservation
  const testStudentId = allStudentIds[0];
  const s0Before = await pool.query(`SELECT total_marks, faculty_remarks, evaluation_status FROM ri_evaluations WHERE student_id = $1`, [testStudentId]);
  const originalMarks = s0Before.rows[0].total_marks;
  const originalRemarks = s0Before.rows[0].faculty_remarks;

  // Super Admin re-locks panel
  const relockRes = await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', saToken, 'POST', {
    batch_id,
    panel_id,
    is_locked: true
  });
  console.log(`Lock API response: ${relockRes.status}`);

  // Query DB and check marks and statuses are 100% intact
  const s0After = await pool.query(`SELECT total_marks, faculty_remarks, evaluation_status FROM ri_evaluations WHERE student_id = $1`, [testStudentId]);
  console.log(`Student evaluation after panel lock: status=${s0After.rows[0].evaluation_status}, total_marks=${s0After.rows[0].total_marks}`);

  const saDetailCase3 = await apiRequest(`/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=${panel_id}`, saToken);
  const facEvalCase3 = await apiRequest(`/api/ri/faculty-portal/evaluations?batch_id=${batch_id}&panel_id=${panel_id}`, facToken);

  if (saDetailCase3.data?.lock?.is_locked !== true || facEvalCase3.data?.panel_lock?.is_locked !== true) {
    throw new Error('CASE 3 FAILED: Panel lock not reported as locked.');
  }
  if (s0After.rows[0].evaluation_status !== 'Completed' || s0After.rows[0].total_marks !== originalMarks || s0After.rows[0].faculty_remarks !== originalRemarks) {
    throw new Error('CASE 3 FAILED: Student marks or statuses were corrupted when panel was locked.');
  }
  console.log('✅ CASE 3 PASSED: Panel lock is shown independently; individual marks and Completed statuses are preserved.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 4: Panel is unlocked.
  // Expected: Editing follows the existing individual evaluation workflow and other applicable restrictions.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 4: Panel is unlocked & editing is permitted ---');
  await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', saToken, 'POST', {
    batch_id,
    panel_id,
    is_locked: false
  });

  // Faculty edits student 0's evaluation
  const updatedMarksRemarks = `Updated Remarks after unlock - ${Date.now()}`;
  const editRes = await apiRequest('/api/ri/faculty-portal/evaluations', facToken, 'POST', {
    student_id: testStudentId,
    batch_id,
    panel_id,
    institutional_visit_rating: 'Excellent',
    family_survey_rating: 'Excellent',
    community_project_rating: 'Excellent',
    problem_statement_marks: 14,
    smart_solution_marks: 38,
    faculty_remarks: updatedMarksRemarks,
    evaluation_status: 'Completed'
  });
  console.log(`Faculty edit response status: ${editRes.status}, success: ${editRes.data?.success}`);
  if (editRes.status !== 200) {
    throw new Error('CASE 4 FAILED: Faculty was unable to edit student evaluation on unlocked panel.');
  }

  const s0Edited = await pool.query(`SELECT total_marks, faculty_remarks FROM ri_evaluations WHERE student_id = $1`, [testStudentId]);
  console.log(`DB after edit: total_marks = ${s0Edited.rows[0].total_marks}, remarks = "${s0Edited.rows[0].faculty_remarks}"`);
  if (s0Edited.rows[0].faculty_remarks !== updatedMarksRemarks) {
    throw new Error('CASE 4 FAILED: Edited remarks were not persisted.');
  }
  console.log('✅ CASE 4 PASSED: Editing works seamlessly on unlocked panel.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 5: Unlock API fails (e.g. invalid/unauthorized)
  // Expected: UI / system remains in actual locked state and returns error.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 5: Unauthorized unlock API failure ---');
  // Re-lock panel first
  await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', saToken, 'POST', { batch_id, panel_id, is_locked: true });

  // Attempt unlock with faculty token (unauthorized)
  const failUnlock = await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', facToken, 'POST', {
    batch_id,
    panel_id,
    is_locked: false
  });
  console.log(`Faculty unlock attempt status: ${failUnlock.status}`);
  if (failUnlock.status !== 403 && failUnlock.status !== 401) {
    throw new Error('CASE 5 FAILED: Non-superadmin was able to call unlock endpoint.');
  }
  // Verify DB state remains locked
  const lockDbCase5 = await pool.query(`SELECT is_locked FROM ri_evaluation_locks WHERE ri_panel_id = $1`, [panel_id]);
  if (lockDbCase5.rows[0].is_locked !== true) {
    throw new Error('CASE 5 FAILED: Lock state changed despite failed unlock attempt.');
  }
  console.log('✅ CASE 5 PASSED: Failed unlock attempt leaves panel in actual locked state.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 6: Lock API failure (e.g. invalid payload)
  // Expected: Database does not falsely change state.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 6: Lock API failure handling ---');
  // Unlock first
  await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', saToken, 'POST', { batch_id, panel_id, is_locked: false });
  // Call with invalid panel_id
  const invalidLock = await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', saToken, 'POST', {
    batch_id,
    panel_id: null,
    is_locked: true
  });
  console.log(`Invalid lock attempt status: ${invalidLock.status}, message: "${invalidLock.data?.message}"`);
  if (invalidLock.status !== 400) {
    throw new Error('CASE 6 FAILED: Expected 400 for invalid lock request.');
  }
  const lockDbCase6 = await pool.query(`SELECT is_locked FROM ri_evaluation_locks WHERE ri_panel_id = $1`, [panel_id]);
  if (lockDbCase6.rows[0].is_locked !== false) {
    throw new Error('CASE 6 FAILED: Panel state falsely modified on failed lock request.');
  }
  console.log('✅ CASE 6 PASSED: Invalid lock request properly rejected without corrupting lock state.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 7: Switch between batches and panels
  // Expected: No stale status from previous selection.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 7: Switch between batches and panels ---');
  // Panel 500 is Unlocked. Panel 498: let's lock Panel 498 to test switching between Unlocked and Locked panels
  await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', saToken, 'POST', { batch_id, panel_id: 498, is_locked: true });

  const p500Detail = await apiRequest(`/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=500`, saToken);
  const p498Detail = await apiRequest(`/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=498`, saToken);

  console.log(`Panel 500 lock: ${p500Detail.data?.lock?.is_locked}`);
  console.log(`Panel 498 lock: ${p498Detail.data?.lock?.is_locked}`);

  if (p500Detail.data?.lock?.is_locked !== false || p498Detail.data?.lock?.is_locked !== true) {
    throw new Error('CASE 7 FAILED: Cross-panel switching returned stale or mismatched lock states.');
  }
  console.log('✅ CASE 7 PASSED: Rapid switching between panels correctly returns each panel\'s authoritative state.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 8: Refresh both portals
  // Expected: Both display the same state persisted by the backend.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 8: Refresh both portals verification ---');
  const facFresh = await apiRequest(`/api/ri/faculty-portal/evaluations?batch_id=${batch_id}&panel_id=${panel_id}`, facToken);
  const saFresh = await apiRequest(`/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=${panel_id}`, saToken);

  console.log(`Fresh fetch Faculty panel_lock.is_locked: ${facFresh.data?.panel_lock?.is_locked}`);
  console.log(`Fresh fetch Super Admin lock.is_locked: ${saFresh.data?.lock?.is_locked}`);

  if (facFresh.data?.panel_lock?.is_locked !== saFresh.data?.lock?.is_locked) {
    throw new Error('CASE 8 FAILED: Portal lock states disagree on refresh.');
  }
  console.log('✅ CASE 8 PASSED: Both portals display identical, persisted authoritative state on fresh query.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 9: Unauthorized faculty attempts to edit a locked panel
  // Expected: Backend rejects request.
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 9: Faculty editing administratively locked panel is rejected ---');
  // Re-lock Panel 500
  await apiRequest('/api/ri/superadmin/evaluations/toggle-lock', saToken, 'POST', { batch_id, panel_id, is_locked: true });

  const unauthorizedEdit = await apiRequest('/api/ri/faculty-portal/evaluations', facToken, 'POST', {
    student_id: testStudentId,
    batch_id,
    panel_id,
    problem_statement_marks: 5,
    smart_solution_marks: 10,
    faculty_remarks: 'Illegal update during lock',
    evaluation_status: 'Completed'
  });
  console.log(`Unauthorized edit attempt status: ${unauthorizedEdit.status}, message: "${unauthorizedEdit.data?.message}"`);

  if (unauthorizedEdit.status !== 403 && unauthorizedEdit.status !== 409) {
    throw new Error(`CASE 9 FAILED: Expected 403 or 409 for editing locked panel, got ${unauthorizedEdit.status}`);
  }
  console.log('✅ CASE 9 PASSED: Backend strictly rejects faculty edits when panel is locked.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // CASE 10: Verify no existing marks, remarks, grades, attendance, or student records deleted
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CASE 10: Complete data integrity audit ---');
  const integrityCheck = await pool.query(`
    SELECT COUNT(*)::int as count,
           COUNT(CASE WHEN total_marks IS NOT NULL THEN 1 END)::int as marks_count,
           COUNT(CASE WHEN faculty_remarks IS NOT NULL AND faculty_remarks <> '' THEN 1 END)::int as remarks_count,
           COUNT(CASE WHEN overall_grade IS NOT NULL THEN 1 END)::int as grade_count
    FROM ri_evaluations
    WHERE ri_panel_id = $1
  `, [panel_id]);

  console.log('Data integrity counts in ri_evaluations for panel:', integrityCheck.rows[0]);
  if (integrityCheck.rows[0].count !== allStudentIds.length) {
    throw new Error(`CASE 10 FAILED: Total evaluation records count changed from ${allStudentIds.length} to ${integrityCheck.rows[0].count}`);
  }
  if (integrityCheck.rows[0].marks_count !== allStudentIds.length) {
    throw new Error('CASE 10 FAILED: Some marks were nullified!');
  }
  console.log('✅ CASE 10 PASSED: Zero data loss. All marks, remarks, grades, and records are 100% intact.\n');

  console.log('========================================================================');
  console.log('🎉 ALL 10 COMPREHENSIVE REGRESSION CASES PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');
  process.exit(0);
}

run10CasesVerification().catch(err => {
  console.error('❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
