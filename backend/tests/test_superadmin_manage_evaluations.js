const pool = require('../config/db');
const jwt = require('jsonwebtoken');

async function runTests() {
  console.log('========================================================');
  console.log('TESTING RI SUPER ADMIN MANAGE EVALUATION & UNLOCK SYSTEM');
  console.log('========================================================\n');

  // 1. Get Super Admin User
  const saRes = await pool.query(`SELECT id, name, email, role FROM users WHERE role IN ('superadmin-ri', 'superadmin') LIMIT 1`);
  if (saRes.rowCount === 0) {
    throw new Error('No superadmin user found in database.');
  }
  const saUser = saRes.rows[0];
  console.log(`Testing with Super Admin: ${saUser.name} (${saUser.email}) [${saUser.role}]`);

  const token = jwt.sign(
    { id: saUser.id, email: saUser.email, role: saUser.role },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '2h' }
  );
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Pick an active batch and panel
  const panelRes = await pool.query(`
    SELECT rp.id AS panel_id, rp.ri_batch_id AS batch_id, rb.name AS batch_name, rp.name AS panel_name
    FROM ri_panels rp
    JOIN ri_batches rb ON rp.ri_batch_id = rb.id
    WHERE rb.status <> 'deleted'
    LIMIT 1
  `);
  if (panelRes.rowCount === 0) {
    throw new Error('No active RI panel found in database.');
  }
  const { panel_id, batch_id, batch_name, panel_name } = panelRes.rows[0];
  console.log(`Testing with Batch: "${batch_name}" (ID: ${batch_id}), Panel: "${panel_name}" (ID: ${panel_id})\n`);

  const API_BASE = 'http://localhost:5001';

  // TEST 1: Fetch batch panels
  console.log('--- TEST 1: GET /api/ri/superadmin/evaluations/panels ---');
  const panelsRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/panels?batch_id=${batch_id}`, {
    headers: authHeaders
  });
  console.log('Status:', panelsRes.status);
  const panelsData = await panelsRes.json();
  if (!panelsRes.ok || !panelsData.success) {
    throw new Error(`Failed to fetch panels: ${JSON.stringify(panelsData)}`);
  }
  console.log(`✅ TEST 1 PASSED: Retrieved ${panelsData.panels.length} panels for batch ${batch_id}.\n`);

  // TEST 2: Fetch panel evaluation detail & student roster
  console.log('--- TEST 2: GET /api/ri/superadmin/evaluations/panel-detail ---');
  const detailRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=${panel_id}`, {
    headers: authHeaders
  });
  console.log('Status:', detailRes.status);
  const detailData = await detailRes.json();
  if (!detailRes.ok || !detailData.success) {
    throw new Error(`Failed to fetch panel detail: ${JSON.stringify(detailData)}`);
  }
  console.log(`Panel Name: ${detailData.panel.name}`);
  console.log(`Total Students: ${detailData.total}`);
  console.log(`Current Lock Status: is_locked=${detailData.lock.is_locked} (${detailData.lock.lock_reason})`);
  console.log(`✅ TEST 2 PASSED: Successfully loaded panel evaluation detail.\n`);

  // TEST 3: Lock Panel Evaluation
  console.log('--- TEST 3: POST /api/ri/superadmin/evaluations/toggle-lock (LOCK) ---');
  const lockRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/toggle-lock`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ batch_id, panel_id, is_locked: true })
  });
  console.log('Status:', lockRes.status);
  const lockData = await lockRes.json();
  if (!lockRes.ok || !lockData.is_locked) {
    throw new Error(`Failed to lock panel: ${JSON.stringify(lockData)}`);
  }
  console.log('Result:', lockData.message);
  console.log(`✅ TEST 3 PASSED: Panel evaluation locked successfully.\n`);

  // TEST 4: Unlock Panel Evaluation
  console.log('--- TEST 4: POST /api/ri/superadmin/evaluations/toggle-lock (UNLOCK) ---');
  const unlockRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/toggle-lock`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ batch_id, panel_id, is_locked: false })
  });
  console.log('Status:', unlockRes.status);
  const unlockData = await unlockRes.json();
  if (!unlockRes.ok || unlockData.is_locked !== false) {
    throw new Error(`Failed to unlock panel: ${JSON.stringify(unlockData)}`);
  }
  console.log('Result:', unlockData.message);
  console.log(`✅ TEST 4 PASSED: Panel evaluation unlocked successfully.\n`);

  // TEST 5: Verify detail reflects unlocked state
  console.log('--- TEST 5: Verify lock reflection in panel-detail ---');
  const verifyRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/panel-detail?batch_id=${batch_id}&panel_id=${panel_id}`, {
    headers: authHeaders
  });
  const verifyData = await verifyRes.json();
  if (verifyData.lock.is_locked !== false || !verifyData.lock.is_explicitly_unlocked) {
    throw new Error(`Expected is_locked=false and is_explicitly_unlocked=true, got: ${JSON.stringify(verifyData.lock)}`);
  }
  console.log(`Lock State: is_locked=${verifyData.lock.is_locked}, reason="${verifyData.lock.lock_reason}"`);
  console.log(`✅ TEST 5 PASSED: Unlocked state verified.\n`);

  // TEST 6: Save an evaluation as Super Admin
  if (detailData.students.length > 0) {
    console.log('--- TEST 6: Save Evaluation via savePanelEvaluationAdmin ---');
    const firstStudent = detailData.students[0];
    const saveRes = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/panel-save`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        batch_id,
        panel_id,
        evaluations: [{
          student_id: firstStudent.student_id,
          institutional_visit_rating: 'Excellent',
          family_survey_rating: 'Good',
          community_project_rating: 'Excellent',
          problem_statement_marks: 12,
          smart_solution_marks: 35,
          faculty_remarks: 'Super Admin test evaluation update',
          evaluation_status: 'Draft'
        }]
      })
    });
    console.log('Status:', saveRes.status);
    const saveData = await saveRes.json();
    if (!saveRes.ok || !saveData.success) {
      throw new Error(`Failed to save evaluation: ${JSON.stringify(saveData)}`);
    }
    console.log(`Result: ${saveData.message}`);
    console.log(`✅ TEST 6 PASSED: Super Admin evaluation saved successfully.\n`);
  }

  console.log('========================================================');
  console.log('🎉 ALL SUPER ADMIN MANAGE EVALUATION TESTS PASSED!');
  console.log('========================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
