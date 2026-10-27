const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { updateBatchFaculty, bulkUploadFaculty } = require('../controllers/riController');
const { login } = require('../controllers/authController');
const { getFacultyDashboard } = require('../controllers/riFacultyController');

async function runTest() {
  console.log('====================================================');
  console.log('TEST: RI Faculty Email Update & Authentication Flow');
  console.log('====================================================\n');

  const timestamp = Date.now();
  const oldEmail = `faculty_old_${timestamp}@gmail.com`;
  const newEmail = `faculty_new_${timestamp}@gmail.com`;
  const password = 'Password@123';

  let batchId = null;
  let panelId = null;
  let facultyAssignmentId = null;
  let facultyUserId = null;
  let studentId = null;

  try {
    // Setup test batch and panel
    const batchRes = await pool.query(`
      INSERT INTO ri_batches (name, batch_code, status, start_date, end_date, panel_capacity, source_program)
      VALUES ('Test RI Batch ${timestamp}', 'RI-BATCH-${timestamp}', 'Active', '2026-03-01', '2026-03-10', 60, 'RI_DIRECT')
      RETURNING id
    `);
    batchId = batchRes.rows[0].id;

    const panelRes = await pool.query(`
      INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
      VALUES ($1, 1, 'P1 - Agriculture Focus', 60)
      RETURNING id
    `, [batchId]);
    panelId = panelRes.rows[0].id;

    // Create user in users table
    const passHash = await bcrypt.hash(password, 10);
    const userRes = await pool.query(`
      INSERT INTO users (name, email, password, role, department, designation, phone, status)
      VALUES ('Dr. Initial Faculty', $1, $2, 'ri_faculty', 'Biotechnology', 'Associate Professor', '9876543210', 'active')
      RETURNING id
    `, [oldEmail, passHash]);
    facultyUserId = userRes.rows[0].id;

    // Assign faculty to panel in ri_batch_faculty
    const facAssignRes = await pool.query(`
      INSERT INTO ri_batch_faculty (ri_batch_id, ri_panel_id, faculty_id, name, email, phone, department, designation, role, status)
      VALUES ($1, $2, $3, 'Dr. Initial Faculty', $4, '9876543210', 'Biotechnology', 'Associate Professor', 'Lead Mentor', 'active')
      RETURNING id
    `, [batchId, panelId, facultyUserId, oldEmail]);
    facultyAssignmentId = facAssignRes.rows[0].id;

    // Enroll a test student
    const studentUserRes = await pool.query(`
      INSERT INTO users (name, email, password, role, prn, status)
      VALUES ('Test Student ${timestamp}', 'student_${timestamp}@example.com', $1, 'student', 'PRN${timestamp}', 'active')
      RETURNING id
    `, [passHash]);
    studentId = studentUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO ri_batch_students (ri_batch_id, student_id, ri_panel_id, source_program, enrollment_type, ri_id)
      VALUES ($1, $2, $3, 'RI_DIRECT', 'RI_DIRECT', 'RI-${batchId}-1')
    `, [batchId, studentId, panelId]);

    // Create attendance record marked by oldEmail
    await pool.query(`
      INSERT INTO ri_attendance (ri_batch_id, ri_panel_id, student_id, day, date, status, marked_by_email)
      VALUES ($1, $2, $3, 'Day 1', '2026-03-02', 'Present', $4)
    `, [batchId, panelId, studentId, oldEmail]);

    // Create evaluation record by oldEmail
    await pool.query(`
      INSERT INTO ri_evaluations (
        student_id, ri_batch_id, ri_panel_id, evaluator_faculty_id, evaluator_faculty_email,
        total_marks, overall_grade
      )
      VALUES ($1, $2, $3, $4, $5, 80, 'A')
    `, [studentId, batchId, panelId, facultyUserId, oldEmail]);

    console.log(`✓ Step 0: Created Faculty assignment ID ${facultyAssignmentId} with user ID ${facultyUserId}, old email: ${oldEmail}`);

    // Helper mock function for login controller
    const attemptLogin = async (loginEmail, loginPassword) => {
      let responseData = null;
      let statusCode = 200;
      const req = { body: { email: loginEmail, password: loginPassword } };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { responseData = data; return res; }
      };
      await login(req, res);
      return { statusCode, responseData };
    };

    // Helper mock function for updateBatchFaculty
    const executeUpdateFaculty = async (id, updateBody) => {
      let responseData = null;
      let statusCode = 200;
      const req = { params: { facultyId: id }, body: updateBody };
      const res = {
        status: (code) => { statusCode = code; return res; },
        json: (data) => { responseData = data; return res; }
      };
      await updateBatchFaculty(req, res);
      return { statusCode, responseData };
    };

    // --- TEST 0: Verify initial login with old email succeeds ---
    console.log('\n--- Testing Initial State ---');
    const initLogin = await attemptLogin(oldEmail, password);
    if (initLogin.statusCode !== 200 || !initLogin.responseData.token) {
      throw new Error(`Initial login with old email failed: ${JSON.stringify(initLogin.responseData)}`);
    }
    console.log(`✓ Initial login with old email (${oldEmail}) succeeded. is_ri_faculty: ${initLogin.responseData.user.is_ri_faculty}`);

    // --- EXECUTE UPDATE: Change email from oldEmail to newEmail ---
    console.log('\n--- Updating Faculty Email via Admin updateBatchFaculty ---');
    const updateResult = await executeUpdateFaculty(facultyAssignmentId, {
      name: 'Dr. Initial Faculty (Updated)',
      email: newEmail,
      phone: '9998887776',
      ri_panel_id: panelId,
      department: 'Biotechnology Dept',
      designation: 'Professor'
    });

    if (updateResult.statusCode !== 200) {
      throw new Error(`updateBatchFaculty failed: ${JSON.stringify(updateResult.responseData)}`);
    }
    console.log(`✓ updateBatchFaculty returned 200 OK. Faculty email in response: ${updateResult.responseData.faculty.email}`);

    // --- TEST 1: Login with old email MUST FAIL ---
    console.log('\n--- TEST 1: Login with Old Email ---');
    const oldLogin = await attemptLogin(oldEmail, password);
    console.log(`   Attempt login with "${oldEmail}": status ${oldLogin.statusCode}, message: "${oldLogin.responseData.message}"`);
    if (oldLogin.statusCode === 200) {
      throw new Error(`CRITICAL FAILURE: Old email (${oldEmail}) still authenticated successfully! It should have been rejected.`);
    }
    console.log('✓ TEST 1 PASSED: Old email no longer authenticates.');

    // --- TEST 2: Login with new email MUST SUCCEED ---
    console.log('\n--- TEST 2: Login with New Email ---');
    const newLogin = await attemptLogin(newEmail, password);
    if (newLogin.statusCode !== 200 || !newLogin.responseData.token) {
      throw new Error(`Login with new email (${newEmail}) failed: ${JSON.stringify(newLogin.responseData)}`);
    }
    console.log(`✓ TEST 2 PASSED: Login with new email (${newEmail}) authenticated successfully!`);
    console.log(`   User ID: ${newLogin.responseData.user.id}, is_ri_faculty: ${newLogin.responseData.user.is_ri_faculty}`);
    if (newLogin.responseData.user.id !== facultyUserId) {
      throw new Error(`User ID changed! Expected ${facultyUserId}, but got ${newLogin.responseData.user.id}`);
    }
    console.log(`✓ Faculty identity preserved: user_id remains ${facultyUserId}.`);

    // --- TEST 3 & 4: Panel assignment, students, attendance, evaluations intact ---
    console.log('\n--- TEST 3 & 4: Checking Panel Assignments, Students, Attendance & Evaluations ---');
    
    // Check profile API with new user session
    const { getFacultyProfile } = require('../controllers/riFacultyController');
    let profileData = null;
    let profileStatus = 200;
    const mockProfileReq = {
      user: { id: facultyUserId, email: newEmail, name: 'Dr. Initial Faculty (Updated)' },
      userEmail: newEmail,
      query: {}
    };
    const mockProfileRes = {
      status: (code) => { profileStatus = code; return mockProfileRes; },
      json: (data) => { profileData = data; return mockProfileRes; }
    };
    await getFacultyProfile(mockProfileReq, mockProfileRes);

    if (profileStatus !== 200 || !profileData.assigned_panels || profileData.assigned_panels.length === 0) {
      throw new Error(`Faculty Profile failed with new email: status ${profileStatus}, data: ${JSON.stringify(profileData)}`);
    }
    console.log(`✓ Faculty Profile with new email loaded ${profileData.assigned_panels.length} assigned panel(s):`);
    console.log(`   Panel Name: ${profileData.assigned_panels[0].panel_name}, Village: ${profileData.assigned_panels[0].village_name || 'None'}`);

    // Check panel dashboard API through real riFacultyAuth middleware with new token
    const riFacultyAuth = require('../middleware/riFacultyAuth');
    let dashboardData = null;
    let dashboardStatus = 200;
    const mockDashReq = {
      method: 'GET',
      headers: { authorization: `Bearer ${newLogin.responseData.token}` },
      query: { batch_id: String(batchId), panel_id: String(panelId) }
    };
    const mockDashRes = {
      status: (code) => { dashboardStatus = code; return mockDashRes; },
      json: (data) => { dashboardData = data; return mockDashRes; }
    };
    await new Promise((resolve, reject) => {
      riFacultyAuth(mockDashReq, mockDashRes, async (err) => {
        if (err) return reject(err);
        try {
          await getFacultyDashboard(mockDashReq, mockDashRes);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });

    if (dashboardStatus !== 200 || !dashboardData.panel) {
      throw new Error(`Faculty Dashboard failed with new email: status ${dashboardStatus}, data: ${JSON.stringify(dashboardData)}`);
    }
    console.log(`✓ Faculty Panel Dashboard loaded successfully for Panel "${dashboardData.panel.panel_name}" (${dashboardData.statistics?.total_students} students)`);

    // Check attendance records updated
    const attRes = await pool.query(
      `SELECT * FROM ri_attendance WHERE ri_panel_id = $1 AND student_id = $2`,
      [panelId, studentId]
    );
    console.log(`✓ Attendance record preserved: status "${attRes.rows[0].status}", marked_by_email: "${attRes.rows[0].marked_by_email}"`);
    if (attRes.rows[0].marked_by_email !== newEmail) {
      throw new Error(`Attendance marked_by_email was not updated to ${newEmail}! Got: ${attRes.rows[0].marked_by_email}`);
    }

    // Check evaluations records updated
    const evalRes = await pool.query(
      `SELECT * FROM ri_evaluations WHERE ri_panel_id = $1 AND student_id = $2`,
      [panelId, studentId]
    );
    console.log(`✓ Evaluation record preserved: total score ${evalRes.rows[0].total_marks}, evaluator_faculty_email: "${evalRes.rows[0].evaluator_faculty_email}"`);
    if (evalRes.rows[0].evaluator_faculty_email !== newEmail) {
      throw new Error(`Evaluation evaluator_faculty_email was not updated to ${newEmail}! Got: ${evalRes.rows[0].evaluator_faculty_email}`);
    }

    // --- TEST 5: Logout / Login again with new email ---
    console.log('\n--- TEST 5: Subsequent Login / Session Refresh ---');
    const secondLogin = await attemptLogin(newEmail, password);
    if (secondLogin.statusCode !== 200 || !secondLogin.responseData.token) {
      throw new Error(`Second login with new email failed: ${JSON.stringify(secondLogin.responseData)}`);
    }
    console.log('✓ TEST 5 PASSED: Re-login and session persistence with new email works reliably.');

    // --- TEST 6: Test Bulk-Uploaded Faculty Email Update ---
    console.log('\n--- TEST 6: Testing Bulk-Uploaded Faculty Email Update ---');
    const bulkOldEmail = `bulk_fac_old_${timestamp}@gmail.com`;
    const bulkNewEmail = `bulk_fac_new_${timestamp}@gmail.com`;
    
    // Create new panel for bulk upload
    const bulkPanelRes = await pool.query(`
      INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
      VALUES ($1, 2, 'P2 - Technology Focus', 60)
      RETURNING id
    `, [batchId]);
    const bulkPanelId = bulkPanelRes.rows[0].id;

    // Mock bulk upload
    const mockBulkReq = {
      params: { id: batchId },
      body: {
        mode: 'panel_wise',
        ri_panel_id: bulkPanelId,
        rows: [{
          name: 'Prof. Bulk Mentor',
          email: bulkOldEmail,
          phone: '9123456780',
          department: 'Computer Science',
          designation: 'Assistant Professor',
          role: 'Mentor',
          resolved_panel_id: bulkPanelId
        }]
      }
    };
    let bulkOutput = null;
    const mockBulkRes = {
      status: (code) => mockBulkRes,
      json: (data) => { bulkOutput = data; return mockBulkRes; }
    };
    await bulkUploadFaculty(mockBulkReq, mockBulkRes);
    console.log(`✓ Bulk faculty uploaded: ${JSON.stringify(bulkOutput?.message)}`);

    const bulkFacRecordRes = await pool.query(
      `SELECT * FROM ri_batch_faculty WHERE LOWER(email) = $1`,
      [bulkOldEmail]
    );
    const bulkFacRecord = bulkFacRecordRes.rows[0];
    console.log(`   Bulk faculty record created: ID ${bulkFacRecord.id}, faculty_id ${bulkFacRecord.faculty_id}`);

    // Update bulk-uploaded faculty's email
    const bulkUpdateRes = await executeUpdateFaculty(bulkFacRecord.id, {
      name: 'Prof. Bulk Mentor (Renamed)',
      email: bulkNewEmail,
      phone: '9123456789',
      ri_panel_id: bulkPanelId
    });
    if (bulkUpdateRes.statusCode !== 200) {
      throw new Error(`Bulk faculty email update failed: ${JSON.stringify(bulkUpdateRes.responseData)}`);
    }

    // Login with bulk old email -> should fail
    const bulkOldLogin = await attemptLogin(bulkOldEmail, 'faculty123');
    if (bulkOldLogin.statusCode === 200) {
      throw new Error('Bulk faculty old email still authenticated!');
    }
    console.log(`✓ Bulk faculty old email (${bulkOldEmail}) rejected as expected.`);

    // Login with bulk new email -> should succeed
    const bulkNewLogin = await attemptLogin(bulkNewEmail, 'faculty123');
    if (bulkNewLogin.statusCode !== 200) {
      throw new Error(`Bulk faculty new email (${bulkNewEmail}) failed to authenticate: ${JSON.stringify(bulkNewLogin.responseData)}`);
    }
    console.log(`✓ Bulk faculty new email (${bulkNewEmail}) authenticated successfully! User ID: ${bulkNewLogin.responseData.user.id}`);
    console.log('✓ TEST 6 PASSED: Bulk-uploaded faculty email updates work seamlessly.');

    console.log('\n====================================================');
    console.log('ALL RI FACULTY EMAIL UPDATE & LOGIN TESTS PASSED!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  } finally {
    // Cleanup test records
    if (batchId) {
      await pool.query(`DELETE FROM ri_evaluations WHERE ri_batch_id = $1`, [batchId]);
      await pool.query(`DELETE FROM ri_attendance WHERE ri_batch_id = $1`, [batchId]);
      await pool.query(`DELETE FROM ri_batch_students WHERE ri_batch_id = $1`, [batchId]);
      await pool.query(`DELETE FROM ri_batch_faculty WHERE ri_batch_id = $1`, [batchId]);
      await pool.query(`DELETE FROM ri_panels WHERE ri_batch_id = $1`, [batchId]);
      await pool.query(`DELETE FROM ri_batches WHERE id = $1`, [batchId]);
    }
    if (facultyUserId) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [facultyUserId]);
    }
    if (studentId) {
      await pool.query(`DELETE FROM users WHERE id = $1`, [studentId]);
    }
    await pool.query(`DELETE FROM users WHERE email LIKE '%${timestamp}%'`);
    await pool.end();
  }
}

runTest();
