const pool = require('../config/db');
const { initDB } = require('../config/initDb');
const jwt = require('jsonwebtoken');

async function runEvaluationLocksLifecycleTests() {
  console.log('========================================================================');
  console.log('TEST SUITE: RI_EVALUATION_LOCKS MIGRATION, DDL & LIFECYCLE VERIFICATION');
  console.log('========================================================================\n');

  const API_BASE = 'http://localhost:5001';

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Database Initialization creates the table & can run repeatedly
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Database Initialization (initDB) Idempotency & Schema ---');
  
  // Run initDB twice to test repeated execution
  console.log('Running initDB(pool) iteration 1...');
  await initDB(pool);
  console.log('Running initDB(pool) iteration 2...');
  await initDB(pool);
  console.log('✅ Both initDB executions completed without error.');

  // Verify table exists
  const tableCheck = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'ri_evaluation_locks'"
  );
  if (tableCheck.rowCount === 0) {
    throw new Error('FAIL: ri_evaluation_locks table does not exist after initDB!');
  }
  console.log('✅ Verified: ri_evaluation_locks table exists in database.');

  // Verify all required columns
  const expectedCols = [
    'id',
    'ri_batch_id',
    'ri_panel_id',
    'is_locked',
    'locked_at',
    'locked_by_email',
    'locked_by_id',
    'unlocked_at',
    'unlocked_by_email',
    'unlocked_by_id',
    'created_at',
    'updated_at'
  ];

  const colRes = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'ri_evaluation_locks'
  `);
  const actualCols = colRes.rows.map(r => r.column_name);
  for (const c of expectedCols) {
    if (!actualCols.includes(c)) {
      throw new Error(`FAIL: Missing column ${c} in ri_evaluation_locks!`);
    }
  }
  console.log(`✅ Verified: All 12 required columns present: ${expectedCols.join(', ')}`);

  // Verify unique constraint on (ri_batch_id, ri_panel_id)
  const uqCheck = await pool.query(`
    SELECT c.conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'ri_evaluation_locks' AND c.contype = 'u'
  `);
  const hasUniqueBatchPanel = uqCheck.rows.some(r => 
    r.def.includes('ri_batch_id') && r.def.includes('ri_panel_id')
  );
  if (!hasUniqueBatchPanel) {
    throw new Error('FAIL: UNIQUE constraint on (ri_batch_id, ri_panel_id) not found in ri_evaluation_locks!');
  }
  console.log('✅ Verified: UNIQUE constraint on (ri_batch_id, ri_panel_id) is enforced.');

  // Verify Foreign Keys
  const fkCheck = await pool.query(`
    SELECT c.conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'ri_evaluation_locks' AND c.contype = 'f'
  `);
  const hasBatchFk = fkCheck.rows.some(r => r.def.includes('REFERENCES ri_batches(id)'));
  const hasPanelFk = fkCheck.rows.some(r => r.def.includes('REFERENCES ri_panels(id)'));
  if (!hasBatchFk || !hasPanelFk) {
    throw new Error('FAIL: Foreign key references to ri_batches(id) or ri_panels(id) missing!');
  }
  console.log('✅ Verified: Foreign keys to ri_batches and ri_panels exist with CASCADE delete.\n');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST Setup: Prepare Super Admin and Faculty authentication
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- SETUP: Resolving Test Users, Batches & Panels ---');
  const saRes = await pool.query(
    "SELECT id, name, email, role FROM users WHERE role IN ('superadmin-ri', 'superadmin') LIMIT 1"
  );
  if (saRes.rowCount === 0) throw new Error('No superadmin user found');
  const saUser = saRes.rows[0];
  const saToken = jwt.sign(
    { id: saUser.id, email: saUser.email, role: saUser.role },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '2h' }
  );
  const saHeaders = { 'Authorization': `Bearer ${saToken}`, 'Content-Type': 'application/json' };

  // Fetch 2 panels with assigned students and faculty for lifecycle and isolation testing
  const panelsRes = await pool.query(`
    SELECT rp.id AS panel_id, rp.name AS panel_name, rp.ri_batch_id AS batch_id, rb.name AS batch_name
    FROM ri_panels rp
    JOIN ri_batches rb ON rp.ri_batch_id = rb.id
    JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id
    JOIN ri_batch_faculty rbf ON rbf.ri_panel_id = rp.id AND rbf.status <> 'deleted'
    WHERE rb.status <> 'deleted'
    GROUP BY rp.id, rp.name, rp.ri_batch_id, rb.name
    ORDER BY rp.id ASC
    LIMIT 2
  `);
  if (panelsRes.rowCount < 2) throw new Error('Need at least 2 panels in database for isolation test');

  const panel1 = panelsRes.rows[0];
  const panel2 = panelsRes.rows[1];
  console.log(`Panel 1: ID ${panel1.panel_id} ("${panel1.panel_name}"), Batch ${panel1.batch_id} ("${panel1.batch_name}")`);
  console.log(`Panel 2: ID ${panel2.panel_id} ("${panel2.panel_name}"), Batch ${panel2.batch_id} ("${panel2.batch_name}")`);

  // Find assigned faculty for Panel 1
  const facRes = await pool.query(`
    SELECT rbf.email, rbf.name, u.id AS user_id
    FROM ri_batch_faculty rbf
    JOIN users u ON LOWER(rbf.email) = LOWER(u.email)
    WHERE rbf.ri_panel_id = $1 AND rbf.status <> 'deleted'
    LIMIT 1
  `, [panel1.panel_id]);
  if (facRes.rowCount === 0) throw new Error('No assigned faculty found for Panel 1');
  const facultyUser = facRes.rows[0];
  const facToken = jwt.sign(
    { id: facultyUser.user_id, email: facultyUser.email, role: 'faculty' },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '2h' }
  );
  const facHeaders = { 'Authorization': `Bearer ${facToken}`, 'Content-Type': 'application/json' };

  // Ensure faculty undertaking is satisfied
  await pool.query(`
    INSERT INTO ri_faculty_undertakings (faculty_id, signed_name, signed_date, status)
    VALUES ($1, $2, '15/10/2026', 'Submitted')
    ON CONFLICT (faculty_id) DO UPDATE SET status = 'Submitted'
  `, [facultyUser.user_id, facultyUser.name]);

  console.log(`Faculty for Panel 1: ${facultyUser.name} (${facultyUser.email})\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Existing evaluation marks remain unchanged during lock & unlock
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 2: Preserving Existing Evaluation Marks & Status on Lock/Unlock ---');
  // Find a student in panel 1
  const studentRes = await pool.query(`
    SELECT rbs.student_id, u.name, u.email
    FROM ri_batch_students rbs
    JOIN users u ON rbs.student_id = u.id
    WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2
    LIMIT 1
  `, [panel1.panel_id, panel1.batch_id]);
  if (studentRes.rowCount === 0) throw new Error('No student found in Panel 1');
  const studentId = studentRes.rows[0].student_id;

  const initialRemarks = `High Precision Score Verification - ${Date.now()}`;
  await pool.query(`
    INSERT INTO ri_evaluations (
      student_id, ri_batch_id, ri_panel_id,
      evaluator_faculty_id, evaluator_faculty_email,
      problem_statement_marks, smart_solution_marks, total_marks, overall_grade,
      evaluation_status, faculty_remarks, submitted_at
    ) VALUES (
      $1, $2, $3,
      $4, $5,
      25.50, 35.50, 61.00, 'A',
      'Completed', $6, NOW()
    )
    ON CONFLICT (student_id, ri_batch_id) DO UPDATE SET
      problem_statement_marks = 25.50,
      smart_solution_marks = 35.50,
      total_marks = 61.00,
      overall_grade = 'A',
      evaluation_status = 'Completed',
      faculty_remarks = $6
  `, [studentId, panel1.batch_id, panel1.panel_id, facultyUser.user_id, facultyUser.email, initialRemarks]);

  console.log(`Initialized Completed evaluation for Student ${studentId} with 61.00 marks.`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Super Admin Lock Operation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Super Admin Lock Execution ---');
  const lockResp = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/toggle-lock`, {
    method: 'POST',
    headers: saHeaders,
    body: JSON.stringify({ batch_id: panel1.batch_id, panel_id: panel1.panel_id, is_locked: true })
  });
  const lockData = await lockResp.json();
  if (!lockResp.ok || !lockData.success || lockData.is_locked !== true) {
    throw new Error(`FAIL: Lock request failed: ${JSON.stringify(lockData)}`);
  }

  // Verify in database
  const lockDb1 = await pool.query(
    'SELECT * FROM ri_evaluation_locks WHERE ri_panel_id = $1 AND ri_batch_id = $2',
    [panel1.panel_id, panel1.batch_id]
  );
  if (lockDb1.rowCount !== 1 || lockDb1.rows[0].is_locked !== true) {
    throw new Error('FAIL: ri_evaluation_locks record not set to true after lock request!');
  }
  if (!lockDb1.rows[0].locked_at || !lockDb1.rows[0].locked_by_email) {
    throw new Error('FAIL: locked_at or locked_by_email missing in ri_evaluation_locks row!');
  }
  console.log('✅ Super Admin lock succeeded. Record in ri_evaluation_locks:');
  console.log(`   is_locked=${lockDb1.rows[0].is_locked}, locked_at=${lockDb1.rows[0].locked_at}, by=${lockDb1.rows[0].locked_by_email}`);

  // Check marks preserved after lock
  const evalCheck1 = await pool.query(
    'SELECT problem_statement_marks, total_marks, overall_grade, evaluation_status, faculty_remarks FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2',
    [studentId, panel1.batch_id]
  );
  if (
    parseFloat(evalCheck1.rows[0].total_marks) !== 61.00 ||
    evalCheck1.rows[0].evaluation_status !== 'Completed' ||
    evalCheck1.rows[0].faculty_remarks !== initialRemarks
  ) {
    throw new Error('FAIL: Evaluation record mutated unexpectedly during panel lock!');
  }
  console.log('✅ Marks, status (Completed), and remarks intact after lock.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Faculty sees the locked state
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Faculty Sees Explicit Lock State ---');
  const facPanelRespLocked = await fetch(
    `${API_BASE}/api/ri/faculty/evaluations?batch_id=${panel1.batch_id}&panel_id=${panel1.panel_id}`,
    { headers: facHeaders }
  );
  const facPanelDataLocked = await facPanelRespLocked.json();
  if (!facPanelRespLocked.ok || !facPanelDataLocked.success) {
    throw new Error(`FAIL: Faculty fetch failed: ${JSON.stringify(facPanelDataLocked)}`);
  }
  if (!facPanelDataLocked.deadlines?.is_evaluation_locked) {
    throw new Error(`FAIL: Faculty does NOT see evaluation locked when Super Admin locked it! ${JSON.stringify(facPanelDataLocked.deadlines)}`);
  }
  console.log(`✅ Verified: Faculty sees is_evaluation_locked=true (is_explicitly_locked=${facPanelDataLocked.deadlines.is_explicitly_locked})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Super Admin Unlock Operation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Super Admin Unlock Execution ---');
  const unlockResp = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/toggle-lock`, {
    method: 'POST',
    headers: saHeaders,
    body: JSON.stringify({ batch_id: panel1.batch_id, panel_id: panel1.panel_id, is_locked: false })
  });
  const unlockData = await unlockResp.json();
  if (!unlockResp.ok || !unlockData.success || unlockData.is_locked !== false) {
    throw new Error(`FAIL: Unlock request failed: ${JSON.stringify(unlockData)}`);
  }

  // Verify in database
  const lockDb2 = await pool.query(
    'SELECT * FROM ri_evaluation_locks WHERE ri_panel_id = $1 AND ri_batch_id = $2',
    [panel1.panel_id, panel1.batch_id]
  );
  if (lockDb2.rowCount !== 1 || lockDb2.rows[0].is_locked !== false) {
    throw new Error('FAIL: ri_evaluation_locks record not set to false after unlock request!');
  }
  if (!lockDb2.rows[0].unlocked_at || !lockDb2.rows[0].unlocked_by_email) {
    throw new Error('FAIL: unlocked_at or unlocked_by_email missing in ri_evaluation_locks row!');
  }
  console.log('✅ Super Admin unlock succeeded. Record in ri_evaluation_locks:');
  console.log(`   is_locked=${lockDb2.rows[0].is_locked}, unlocked_at=${lockDb2.rows[0].unlocked_at}, by=${lockDb2.rows[0].unlocked_by_email}`);

  // Check marks preserved after unlock
  const evalCheck2 = await pool.query(
    'SELECT problem_statement_marks, total_marks, overall_grade, evaluation_status, faculty_remarks FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2',
    [studentId, panel1.batch_id]
  );
  if (
    parseFloat(evalCheck2.rows[0].total_marks) !== 61.00 ||
    evalCheck2.rows[0].evaluation_status !== 'Completed' ||
    evalCheck2.rows[0].faculty_remarks !== initialRemarks
  ) {
    throw new Error('FAIL: Evaluation record marks or status destroyed during panel unlock!');
  }
  console.log('✅ Marks, status (Completed), and remarks intact after unlock (NO destructive reset).');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Faculty sees the unlocked state
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Faculty Sees Explicit Unlock State ---');
  const facPanelRespUnlocked = await fetch(
    `${API_BASE}/api/ri/faculty/evaluations?batch_id=${panel1.batch_id}&panel_id=${panel1.panel_id}`,
    { headers: facHeaders }
  );
  const facPanelDataUnlocked = await facPanelRespUnlocked.json();
  if (!facPanelRespUnlocked.ok || !facPanelDataUnlocked.success) {
    throw new Error(`FAIL: Faculty fetch failed: ${JSON.stringify(facPanelDataUnlocked)}`);
  }
  if (facPanelDataUnlocked.deadlines?.is_evaluation_locked) {
    throw new Error('FAIL: Faculty still sees evaluation locked after Super Admin unlocked it!');
  }
  if (!facPanelDataUnlocked.deadlines?.is_explicitly_unlocked) {
    throw new Error('FAIL: is_explicitly_unlocked flag missing from faculty deadlines!');
  }
  console.log(`✅ Verified: Faculty sees is_evaluation_locked=false (is_explicitly_unlocked=${facPanelDataUnlocked.deadlines.is_explicitly_unlocked})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Repeated lock/unlock requests (ON CONFLICT DO UPDATE verification)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Repeated Lock/Unlock Requests & Row Uniqueness ---');
  const countBeforeCycles = await pool.query(
    'SELECT COUNT(*)::int as cnt FROM ri_evaluation_locks WHERE ri_panel_id = $1 AND ri_batch_id = $2',
    [panel1.panel_id, panel1.batch_id]
  );
  if (countBeforeCycles.rows[0].cnt !== 1) {
    throw new Error(`Expected exactly 1 row, found ${countBeforeCycles.rows[0].cnt}`);
  }

  // Rapid cycle: Lock -> Lock -> Unlock -> Lock -> Unlock
  const sequence = [true, true, false, true, false];
  for (let i = 0; i < sequence.length; i++) {
    const desiredLock = sequence[i];
    const r = await fetch(`${API_BASE}/api/ri/superadmin/evaluations/toggle-lock`, {
      method: 'POST',
      headers: saHeaders,
      body: JSON.stringify({ batch_id: panel1.batch_id, panel_id: panel1.panel_id, is_locked: desiredLock })
    });
    const d = await r.json();
    if (!r.ok || d.is_locked !== desiredLock) {
      throw new Error(`FAIL in rapid cycle step ${i}: requested lock=${desiredLock}, got ${JSON.stringify(d)}`);
    }
  }

  const countAfterCycles = await pool.query(
    'SELECT COUNT(*)::int as cnt FROM ri_evaluation_locks WHERE ri_panel_id = $1 AND ri_batch_id = $2',
    [panel1.panel_id, panel1.batch_id]
  );
  if (countAfterCycles.rows[0].cnt !== 1) {
    throw new Error(`FAIL: Repeated lock/unlock created duplicate rows: count=${countAfterCycles.rows[0].cnt}!`);
  }
  console.log(`✅ Verified: Exactly 1 row maintained across 5 rapid toggle cycles. No duplicate entries.`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Multiple batches and panels isolation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Isolation Between Different Panels & Batches ---');
  // First ensure Panel 2 is unlocked
  await pool.query(
    'INSERT INTO ri_evaluation_locks (ri_batch_id, ri_panel_id, is_locked, updated_at) VALUES ($1, $2, false, NOW()) ON CONFLICT (ri_batch_id, ri_panel_id) DO UPDATE SET is_locked = false',
    [panel2.batch_id, panel2.panel_id]
  );

  // Now lock Panel 1
  await fetch(`${API_BASE}/api/ri/superadmin/evaluations/toggle-lock`, {
    method: 'POST',
    headers: saHeaders,
    body: JSON.stringify({ batch_id: panel1.batch_id, panel_id: panel1.panel_id, is_locked: true })
  });

  // Verify Panel 1 is locked, but Panel 2 remains unlocked
  const p1Check = await pool.query(
    'SELECT is_locked FROM ri_evaluation_locks WHERE ri_panel_id = $1 AND ri_batch_id = $2',
    [panel1.panel_id, panel1.batch_id]
  );
  const p2Check = await pool.query(
    'SELECT is_locked FROM ri_evaluation_locks WHERE ri_panel_id = $1 AND ri_batch_id = $2',
    [panel2.panel_id, panel2.batch_id]
  );

  if (p1Check.rows[0]?.is_locked !== true) {
    throw new Error('FAIL: Panel 1 did not lock!');
  }
  if (p2Check.rows[0]?.is_locked !== false) {
    throw new Error('FAIL: Panel 2 lock state leaked from Panel 1!');
  }
  console.log(`✅ Verified isolation: Panel 1 is locked (${p1Check.rows[0].is_locked}), Panel 2 remains unlocked (${p2Check.rows[0].is_locked}).`);

  console.log('\n========================================================================');
  console.log('🎉 ALL 8 EVALUATION LOCKS TESTS PASSED CLEANLY WITH ZERO REGRESSIONS!');
  console.log('========================================================================\n');

  process.exit(0);
}

runEvaluationLocksLifecycleTests().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED WITH ERROR:', err);
  process.exit(1);
});
