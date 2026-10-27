const http = require('http');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

function makeRequest(path, token, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING RI EVALUATION LOCKING SYNCHRONIZATION TESTS ===\n');

  let testFaculty = null;
  let batchId = null;
  let panelId = null;
  let student1Id = null;
  let student2Id = null;
  let token = null;

  try {
    // 1. Find a faculty assigned to a panel with students
    const facultyRes = await pool.query(`
      SELECT rbf.id, rbf.ri_batch_id, rbf.ri_panel_id, rbf.email, rbf.name, u.id as user_id, u.role
      FROM ri_batch_faculty rbf
      JOIN users u ON LOWER(rbf.email) = LOWER(u.email)
      WHERE rbf.status <> 'deleted'
      LIMIT 1
    `);

    if (facultyRes.rows.length === 0) {
      console.error('No assigned faculty found in database.');
      process.exit(1);
    }

    testFaculty = facultyRes.rows[0];
    batchId = testFaculty.ri_batch_id;
    panelId = testFaculty.ri_panel_id;

    console.log(`Using Faculty: ${testFaculty.name} (${testFaculty.email}), Batch: ${batchId}, Panel: ${panelId}`);

    // Generate JWT token for faculty
    token = jwt.sign(
      { id: testFaculty.user_id, email: testFaculty.email, role: 'faculty' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Make sure undertaking exists in ri_faculty_undertakings so portal is accessible
    await pool.query(`
      INSERT INTO ri_faculty_undertakings (faculty_id, signed_name, signed_date, status)
      VALUES ($1, $2, '14/10/2026', 'Submitted')
      ON CONFLICT (faculty_id) DO UPDATE SET status = 'Submitted'
    `, [testFaculty.user_id, testFaculty.name]);

    // Find two students in this panel
    const studentsRes = await pool.query(`
      SELECT rbs.student_id, u.name, u.email
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      LIMIT 2
    `, [batchId, panelId]);

    if (studentsRes.rows.length < 2) {
      console.log('Fewer than 2 students in panel, searching other panel...');
      const anyPanel = await pool.query(`
        SELECT rbs.ri_batch_id, rbs.ri_panel_id, COUNT(*) as cnt
        FROM ri_batch_students rbs
        GROUP BY rbs.ri_batch_id, rbs.ri_panel_id
        HAVING COUNT(*) >= 2
        LIMIT 1
      `);
      if (anyPanel.rows.length > 0) {
        batchId = anyPanel.rows[0].ri_batch_id;
        panelId = anyPanel.rows[0].ri_panel_id;
        // Re-assign faculty to this panel for testing
        await pool.query(`
          INSERT INTO ri_batch_faculty (ri_batch_id, ri_panel_id, name, email, role, status)
          VALUES ($1, $2, $3, $4, 'Accompany Faculty', 'Active')
          ON CONFLICT DO NOTHING
        `, [batchId, panelId, testFaculty.name, testFaculty.email]);

        const stRes = await pool.query(`
          SELECT rbs.student_id, u.name, u.email
          FROM ri_batch_students rbs
          JOIN users u ON rbs.student_id = u.id
          WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
          LIMIT 2
        `, [batchId, panelId]);
        student1Id = stRes.rows[0].student_id;
        student2Id = stRes.rows[1].student_id;
      }
    } else {
      student1Id = studentsRes.rows[0].student_id;
      student2Id = studentsRes.rows[1].student_id;
    }

    console.log(`Test Student 1 ID: ${student1Id}, Student 2 ID: ${student2Id}`);

    // Ensure initial clean state: remove existing evaluation records for test students in this batch
    await pool.query(`
      DELETE FROM ri_evaluations WHERE student_id IN ($1, $2) AND ri_batch_id = $3
    `, [student1Id, student2Id, batchId]);

    // Clean up any test locks in ri_evaluation_locks for this panel so we test from clean state
    await pool.query(`
      DELETE FROM ri_evaluation_locks WHERE ri_panel_id = $1
    `, [panelId]);

    // Ensure panel deadlines are not auto-locked for this batch so we can test evaluation locking
    await pool.query(`
      UPDATE ri_batches SET start_date = CURRENT_DATE, end_date = CURRENT_DATE + INTERVAL '5 days' WHERE id = $1
    `, [batchId]);

    console.log('\n--- TEST 1: Evaluate Student 1 and Save as Draft ---');
    const draftRes = await makeRequest('/api/ri/faculty-portal/evaluations', token, 'POST', {
      student_id: student1Id,
      batch_id: batchId,
      panel_id: panelId,
      institutional_visits_rating: 'Excellent',
      family_survey_rating: 'Good',
      community_projects_rating: 'Satisfactory',
      problem_statement_marks: 12,
      smart_solution_marks: 32,
      faculty_remarks: 'Draft remarks for student 1',
      status: 'Draft'
    });
    console.log(`Draft response status: ${draftRes.status}, success: ${draftRes.body?.success}`);
    if (draftRes.status !== 200) throw new Error('Failed to save draft evaluation');

    // Verify workspace returns is_evaluation_locked: false
    const wsDraft = await makeRequest(`/api/ri/faculty-portal/students/${student1Id}/workspace?batch_id=${batchId}&panel_id=${panelId}`, token);
    console.log(`Workspace for draft: is_evaluation_locked = ${wsDraft.body?.is_evaluation_locked}, eval status = ${wsDraft.body?.evaluation?.evaluation_status}`);
    if (wsDraft.body?.is_evaluation_locked !== false) {
      throw new Error(`Expected is_evaluation_locked to be false for Draft, got ${wsDraft.body?.is_evaluation_locked}`);
    }

    console.log('\n--- TEST 2: Save and Lock Student 1 (status: Completed) ---');
    const lockRes = await makeRequest('/api/ri/faculty-portal/evaluations', token, 'POST', {
      student_id: student1Id,
      batch_id: batchId,
      panel_id: panelId,
      institutional_visits_rating: 'Excellent',
      family_survey_rating: 'Good',
      community_projects_rating: 'Satisfactory',
      problem_statement_marks: 14,
      smart_solution_marks: 36,
      faculty_remarks: 'Finalized and locked marks',
      status: 'Completed'
    });
    console.log(`Lock response status: ${lockRes.status}, success: ${lockRes.body?.success}`);
    if (lockRes.status !== 200) throw new Error('Failed to lock evaluation');

    // Verify in DB that evaluation_status is 'Completed'
    const dbRow = await pool.query(`SELECT evaluation_status, total_marks FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2`, [student1Id, batchId]);
    console.log(`DB evaluation_status: ${dbRow.rows[0]?.evaluation_status}, total_marks: ${dbRow.rows[0]?.total_marks}`);
    if (dbRow.rows[0]?.evaluation_status !== 'Completed') throw new Error('DB status is not Completed');

    console.log('\n--- TEST 3: Workspace details returns is_evaluation_locked: true & is_locked: true ---');
    const wsLocked = await makeRequest(`/api/ri/faculty-portal/students/${student1Id}/workspace?batch_id=${batchId}&panel_id=${panelId}`, token);
    console.log(`Workspace for locked student: is_evaluation_locked = ${wsLocked.body?.is_evaluation_locked}, evaluation.is_locked = ${wsLocked.body?.evaluation?.is_locked}`);
    if (!wsLocked.body?.is_evaluation_locked || !wsLocked.body?.evaluation?.is_locked) {
      throw new Error('Workspace endpoint did not report evaluation as locked!');
    }

    console.log('\n--- TEST 4: Backend rejects direct POST update on locked evaluation (409 Conflict) ---');
    const directUpdateAttempt = await makeRequest('/api/ri/faculty-portal/evaluations', token, 'POST', {
      student_id: student1Id,
      batch_id: batchId,
      panel_id: panelId,
      institutional_visits_rating: 'Unsatisfactory',
      family_survey_rating: 'Unsatisfactory',
      community_projects_rating: 'Unsatisfactory',
      problem_statement_marks: 0,
      smart_solution_marks: 0,
      faculty_remarks: 'Malicious overwrite',
      status: 'Draft'
    });
    console.log(`Direct update attempt status: ${directUpdateAttempt.status}, message: "${directUpdateAttempt.body?.message}"`);
    if (directUpdateAttempt.status !== 409) {
      throw new Error(`Expected 409 Conflict on locked evaluation, got ${directUpdateAttempt.status}`);
    }
    if (directUpdateAttempt.body?.message !== 'This evaluation has been locked and cannot be modified.') {
      throw new Error(`Unexpected message: ${directUpdateAttempt.body?.message}`);
    }

    // Verify DB row remains completely unchanged
    const dbCheck1 = await pool.query(`SELECT evaluation_status, total_marks FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2`, [student1Id, batchId]);
    console.log(`DB after rejected update: total_marks = ${dbCheck1.rows[0]?.total_marks} (Unchanged, did not overwrite)`);
    if (dbCheck1.rows[0]?.total_marks === '0.00' || dbCheck1.rows[0]?.evaluation_status !== 'Completed') {
      throw new Error('Database record was modified despite lock!');
    }

    console.log('\n--- TEST 5: Backend rejects bulk POST update on locked evaluation (409 Conflict) ---');
    const bulkUpdateAttempt = await makeRequest('/api/ri/faculty-portal/evaluations/bulk', token, 'POST', {
      batch_id: batchId,
      panel_id: panelId,
      evaluations: [
        {
          student_id: student1Id,
          institutional_visit_rating: 'Unsatisfactory',
          family_survey_rating: 'Unsatisfactory',
          community_project_rating: 'Unsatisfactory',
          problem_statement_marks: 0,
          smart_solution_marks: 0,
          faculty_remarks: 'Bulk overwrite attempt',
          evaluation_status: 'Draft'
        }
      ]
    });
    console.log(`Bulk update attempt status: ${bulkUpdateAttempt.status}, message: "${bulkUpdateAttempt.body?.message}"`);
    if (bulkUpdateAttempt.status !== 409) {
      throw new Error(`Expected 409 Conflict on bulk update, got ${bulkUpdateAttempt.status}`);
    }

    // Verify DB row remains unchanged
    const dbCheck2 = await pool.query(`SELECT evaluation_status, total_marks FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2`, [student1Id, batchId]);
    if (dbCheck2.rows[0]?.total_marks === '0.00' || dbCheck2.rows[0]?.evaluation_status !== 'Completed') {
      throw new Error('Database record was modified through bulk API despite lock!');
    }

    console.log('\n--- TEST 6: Student 2 (unlocked) can still be saved normally ---');
    const s2Save = await makeRequest('/api/ri/faculty-portal/evaluations', token, 'POST', {
      student_id: student2Id,
      batch_id: batchId,
      panel_id: panelId,
      institutional_visits_rating: 'Good',
      family_survey_rating: 'Good',
      community_projects_rating: 'Good',
      problem_statement_marks: 10,
      smart_solution_marks: 28,
      faculty_remarks: 'Student 2 remarks',
      status: 'Draft'
    });
    console.log(`Student 2 save status: ${s2Save.status}, success: ${s2Save.body?.success}`);
    if (s2Save.status !== 200) throw new Error('Unlocked student 2 could not be saved');

    console.log('\n--- TEST 7: Panel evaluations list returns correct individual is_locked flags ---');
    const panelEvalRes = await makeRequest(`/api/ri/faculty-portal/evaluations?batch_id=${batchId}&panel_id=${panelId}`, token);
    const s1Row = panelEvalRes.body?.students?.find(s => s.student_id === student1Id);
    const s2Row = panelEvalRes.body?.students?.find(s => s.student_id === student2Id);

    console.log(`Student 1 in panel list: evaluation_status = ${s1Row?.evaluation_status}, is_locked = ${s1Row?.is_locked}`);
    console.log(`Student 2 in panel list: evaluation_status = ${s2Row?.evaluation_status}, is_locked = ${s2Row?.is_locked}`);

    if (s1Row?.is_locked !== true) {
      throw new Error(`Expected Student 1 is_locked to be true, got ${s1Row?.is_locked}`);
    }
    if (s2Row?.is_locked !== false) {
      throw new Error(`Expected Student 2 is_locked to be false, got ${s2Row?.is_locked}`);
    }

    console.log('\n--- ALL 7 BACKEND & SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! ---');

  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  } finally {
    // Clean up test evaluation records created
    if (student1Id && student2Id && batchId) {
      await pool.query(`DELETE FROM ri_evaluations WHERE student_id IN ($1, $2) AND ri_batch_id = $3`, [student1Id, student2Id, batchId]);
      console.log('Cleaned up test evaluation rows.');
    }
    await pool.end();
  }
}

runTests();
