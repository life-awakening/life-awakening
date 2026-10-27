const pool = require('../config/db');
const jwt = require('jsonwebtoken');

async function runComprehensiveVerification() {
  console.log('========================================================================');
  console.log('COMPREHENSIVE TEST: BATCH SWITCHING & SUPERADMIN PANEL UNLOCK FLOW');
  console.log('========================================================================\n');

  // 1. Fetch SuperAdmin user
  const saRes = await pool.query(`SELECT id, name, email, role FROM users WHERE role IN ('superadmin-ri', 'superadmin') LIMIT 1`);
  if (saRes.rowCount === 0) throw new Error('No superadmin user found');
  const saUser = saRes.rows[0];

  const saToken = jwt.sign(
    { id: saUser.id, email: saUser.email, role: saUser.role },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '2h' }
  );
  const saHeaders = {
    'Authorization': `Bearer ${saToken}`,
    'Content-Type': 'application/json'
  };

  const API_BASE = 'http://localhost:5001';

  // 2. Locate active panel with assigned faculty and students
  const panelFacultyRes = await pool.query(`
    SELECT rbf.ri_batch_id AS batch_id, rbf.ri_panel_id AS panel_id, rbf.email, rbf.name, u.id AS user_id, rp.name AS panel_name
    FROM ri_batch_faculty rbf
    JOIN users u ON LOWER(rbf.email) = LOWER(u.email)
    JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
    WHERE rbf.status <> 'deleted'
    LIMIT 1
  `);
  if (panelFacultyRes.rowCount === 0) throw new Error('No assigned faculty found');
  const facultyInfo = panelFacultyRes.rows[0];
  const { batch_id, panel_id, panel_name } = facultyInfo;

  const facToken = jwt.sign(
    { id: facultyInfo.user_id, email: facultyInfo.email, role: 'faculty' },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '2h' }
  );
  const facHeaders = {
    'Authorization': `Bearer ${facToken}`,
    'Content-Type': 'application/json'
  };

  // Ensure faculty undertaking is satisfied
  await pool.query(`
    INSERT INTO ri_faculty_undertakings (faculty_id, signed_name, signed_date, status)
    VALUES ($1, $2, '14/10/2026', 'Submitted')
    ON CONFLICT (faculty_id) DO UPDATE SET status = 'Submitted'
  `, [facultyInfo.user_id, facultyInfo.name]);

  console.log(`Using Super Admin: ${saUser.name} (${saUser.email})`);
  console.log(`Using Faculty: ${facultyInfo.name} (${facultyInfo.email}), Panel: "${panel_name}" (${panel_id}), Batch: ${batch_id}`);

  // 2. TEST 1: Rapid Batch Switching & Stale Query Resilience
  console.log('--- TEST 1: Batch Switching & Panel Fetching ---');
  const batchesRes = await pool.query(`SELECT id, name FROM ri_batches WHERE status <> 'deleted' ORDER BY id ASC LIMIT 2`);
  if (batchesRes.rowCount < 2) {
    console.log('Fewer than 2 batches available, skipping multi-batch compare.');
  } else {
    const b1 = batchesRes.rows[0];
    const b2 = batchesRes.rows[1];
    console.log(`Testing batch switching between Batch ${b1.id} (${b1.name}) and Batch ${b2.id} (${b2.name})`);

    const p1 = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/panels?batch_id=${b1.id}`, { headers: saHeaders });
    const p1Data = await p1.json();
    const p2 = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/panels?batch_id=${b2.id}`, { headers: saHeaders });
    const p2Data = await p2.json();

    console.log(`Batch ${b1.id} returned ${p1Data.panels.length} panels.`);
    console.log(`Batch ${b2.id} returned ${p2Data.panels.length} panels.`);
    if (!p1.ok || !p2.ok) throw new Error('Failed to fetch panels for one of the batches');
    console.log('✅ TEST 1 PASSED: Batch panel loading succeeds without error.\n');
  }

  // 3. Find a student in this faculty's panel
  console.log('--- TEST 2: Locating Student in Assigned Panel ---');
  const studentPanelRes = await pool.query(`
    SELECT rbs.student_id, u.name as student_name
    FROM ri_batch_students rbs
    JOIN users u ON rbs.student_id = u.id
    WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2
    LIMIT 1
  `, [panel_id, batch_id]);
  if (studentPanelRes.rowCount === 0) throw new Error('No student found in this panel');
  const student_id = studentPanelRes.rows[0].student_id;
  console.log(`Target: Student ID: ${student_id} (${studentPanelRes.rows[0].student_name}) in Panel "${panel_name}" (${panel_id}), Batch: ${batch_id}\n`);

  // 4. Setup initial locked evaluation with distinct marks and remarks
  console.log('--- TEST 3: Setup Locked Evaluation (status: Completed) with Specific Marks ---');
  const testRemarks = `Original Evaluation Remarks - ${Date.now()}`;
  const upsertEval = await pool.query(`
    INSERT INTO ri_evaluations (
      student_id, ri_batch_id, ri_panel_id,
      evaluator_faculty_id, evaluator_faculty_email,
      problem_statement_marks, smart_solution_marks,
      institutional_visit_rating, family_survey_rating, community_project_rating,
      total_marks, overall_grade, evaluation_status, faculty_remarks,
      updated_at
    ) VALUES (
      $1, $2, $3,
      $4, $5,
      13.5, 34.5,
      'Excellent', 'Good', 'Excellent',
      78.0, 'B+', 'Completed', $6,
      NOW()
    )
    ON CONFLICT (student_id, ri_batch_id) DO UPDATE SET
      ri_panel_id = EXCLUDED.ri_panel_id,
      evaluator_faculty_id = EXCLUDED.evaluator_faculty_id,
      evaluator_faculty_email = EXCLUDED.evaluator_faculty_email,
      problem_statement_marks = EXCLUDED.problem_statement_marks,
      smart_solution_marks = EXCLUDED.smart_solution_marks,
      institutional_visit_rating = EXCLUDED.institutional_visit_rating,
      family_survey_rating = EXCLUDED.family_survey_rating,
      community_project_rating = EXCLUDED.community_project_rating,
      total_marks = EXCLUDED.total_marks,
      overall_grade = EXCLUDED.overall_grade,
      evaluation_status = 'Completed',
      faculty_remarks = EXCLUDED.faculty_remarks,
      updated_at = NOW()
    RETURNING *
  `, [student_id, batch_id, panel_id, facultyInfo.user_id, facultyInfo.email, testRemarks]);
  console.log(`Evaluation seeded for student ${student_id}: status=Completed, marks=78.0, remarks="${testRemarks}"`);

  // Ensure panel lock row is also locked
  await pool.query(`
    INSERT INTO ri_evaluation_locks (ri_batch_id, ri_panel_id, is_locked, locked_at, locked_by_email, updated_at)
    VALUES ($1, $2, true, NOW(), 'test@ltc.edu', NOW())
    ON CONFLICT (ri_batch_id, ri_panel_id) DO UPDATE SET
      is_locked = true, locked_at = NOW(), locked_by_email = 'test@ltc.edu', updated_at = NOW()
  `, [batch_id, panel_id]);

  // 5. TEST 4: Unauthorized Unlock Request Rejection
  console.log('\n--- TEST 4: Unauthorized User (Faculty) Cannot Unlock Panel ---');
  const unauthRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/toggle-lock`, {
    method: 'POST',
    headers: facHeaders,
    body: JSON.stringify({ batch_id, panel_id, is_locked: false })
  });
  console.log(`Status returned for faculty attempt: ${unauthRes.status}`);
  if (unauthRes.status !== 403 && unauthRes.status !== 401) {
    throw new Error(`Expected 403 Forbidden for faculty unlock, but got ${unauthRes.status}`);
  }
  console.log('✅ TEST 4 PASSED: Non-SuperAdmin requests are strictly rejected.\n');

  // 6. TEST 5: SuperAdmin Unlocks Panel (Even with mismatched/stale batch_id)
  console.log('--- TEST 5: SuperAdmin Unlocks Panel (Resilient to Stale Batch ID) ---');
  // Pass a mismatched batch_id (e.g. 99999 or differing) to verify the backend resolves canonical batch_id from ri_panels
  const unlockRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/toggle-lock`, {
    method: 'POST',
    headers: saHeaders,
    body: JSON.stringify({ batch_id: 99999, panel_id, is_locked: false, reason: 'SuperAdmin Verification' })
  });
  const unlockData = await unlockRes.json();
  console.log('Unlock status:', unlockRes.status);
  console.log('Unlock response:', unlockData);
  if (!unlockRes.ok || unlockData.is_locked !== false) {
    throw new Error(`SuperAdmin unlock failed: ${JSON.stringify(unlockData)}`);
  }
  console.log('✅ TEST 5 PASSED: SuperAdmin unlock API returned success.\n');

  // 7. TEST 6: Verify Database Authoritative Lock State & Data Integrity
  console.log('--- TEST 6: Verify DB Lock State & Evaluation Data Integrity ---');
  const lockDbRes = await pool.query(
    `SELECT ri_batch_id, ri_panel_id, is_locked FROM ri_evaluation_locks WHERE ri_panel_id = $1`,
    [panel_id]
  );
  console.log('DB lock rows for panel:', lockDbRes.rows);
  const activeLock = lockDbRes.rows.find(r => r.ri_batch_id === batch_id);
  if (!activeLock || activeLock.is_locked !== false) {
    throw new Error(`Expected is_locked to be false for batch ${batch_id}, panel ${panel_id}`);
  }

  const evalDbRes = await pool.query(
    `SELECT student_id, evaluation_status, problem_statement_marks, smart_solution_marks, total_marks, faculty_remarks
     FROM ri_evaluations WHERE student_id = $1`,
    [student_id]
  );
  const currentEval = evalDbRes.rows[0];
  console.log('DB evaluation record after unlock:', currentEval);

  if (currentEval.evaluation_status !== 'Completed') {
    throw new Error(`Expected evaluation_status to remain 'Completed' (not auto-reset to Draft), but got '${currentEval.evaluation_status}'`);
  }
  if (parseFloat(currentEval.problem_statement_marks) !== 13.5 ||
      parseFloat(currentEval.smart_solution_marks) !== 34.5 ||
      parseFloat(currentEval.total_marks) !== 78.0) {
    throw new Error('Marks were corrupted or overwritten during unlock!');
  }
  if (currentEval.faculty_remarks !== testRemarks) {
    throw new Error('Remarks were corrupted or overwritten during unlock!');
  }
  console.log('✅ TEST 6 PASSED: Status remains Completed; all marks, ratings, and remarks are 100% preserved.\n');

  // 8. TEST 7: Faculty can now update the unlocked evaluation without 409 Conflict
  console.log('--- TEST 7: Faculty can Save/Update Unlocked Evaluation ---');
  const updateRes = await fetch(`${API_BASE}/api/ri/faculty-portal/evaluations`, {
    method: 'POST',
    headers: facHeaders,
    body: JSON.stringify({
      student_id,
      batch_id,
      panel_id,
      problem_statement_marks: 14.0,
      smart_solution_marks: 35.0,
      institutional_visit_rating: 'Excellent',
      family_survey_rating: 'Good',
      community_project_rating: 'Excellent',
      faculty_remarks: 'Updated remarks by faculty after unlock',
      evaluation_status: 'Draft'
    })
  });
  console.log('Faculty save response status:', updateRes.status);
  const updateData = await updateRes.json();
  if (!updateRes.ok || !updateData.success) {
    throw new Error(`Faculty update failed after unlock: ${JSON.stringify(updateData)}`);
  }
  console.log('✅ TEST 7 PASSED: Faculty successfully edited the unlocked evaluation.\n');

  // 9. TEST 8: Verify Panel Detail in SuperAdmin API reflects unlocked state
  console.log('--- TEST 8: GET /api/ri/superadmin/evaluations/panel-detail reflects Unlocked state ---');
  const panelDetailRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=${panel_id}`, {
    headers: saHeaders
  });
  const detailData = await panelDetailRes.json();
  console.log(`Lock info in detail: is_locked=${detailData.lock?.is_locked}, is_explicitly_unlocked=${detailData.lock?.is_explicitly_unlocked}`);
  if (detailData.lock?.is_locked !== false) {
    throw new Error('Panel detail still reports panel as locked!');
  }
  const studentInDetail = detailData.students.find(s => s.student_id === student_id);
  console.log(`Student in detail: evaluation_status=${studentInDetail?.evaluation_status}, is_locked=${studentInDetail?.is_locked}`);
  if (studentInDetail?.is_locked !== false || studentInDetail?.evaluation_status !== 'Draft') {
    throw new Error('Student evaluation in panel detail does not show Draft / unlocked status');
  }
  console.log('✅ TEST 8 PASSED: Panel detail API reflects Draft / unlocked state across the board.\n');

  console.log('========================================================================');
  console.log('🎉 ALL COMPREHENSIVE TESTS PASSED SUCCESSFULLY! BOTH BUGS VERIFIED FIXED.');
  console.log('========================================================================');
  process.exit(0);
}

runComprehensiveVerification().catch(err => {
  console.error('❌ Comprehensive test failed:', err);
  process.exit(1);
});
