const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (dataStr) headers['Content-Length'] = Buffer.byteLength(dataStr);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path,
      method,
      headers
    }, (res) => {
      let resp = '';
      res.on('data', d => resp += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resp) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resp });
        }
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('TESTING VILLAGE & FACULTY LOGIN, AUTO-PROVISIONING & REUSE FLOW');
  console.log('================================================================\n');

  // 1. Verify Existing Role Logins (Admin, SuperAdmin, Student)
  console.log('--- 1. Testing Existing Role Logins ---');
  const adminLogin = await makeRequest('POST', '/api/login', { email: 'admin@ltc.edu', password: 'Pppp0000@' });
  console.log('Admin login status:', adminLogin.status, adminLogin.body?.user?.role);
  if (adminLogin.status !== 200 || adminLogin.body?.user?.role !== 'admin') {
    throw new Error('Admin login failed');
  }

  const superAdminLogin = await makeRequest('POST', '/api/login', { email: 'superadmin@ltc.edu', password: 'Pppp0000@' });
  console.log('Superadmin login status:', superAdminLogin.status, superAdminLogin.body?.user?.role);
  if (superAdminLogin.status !== 200 || superAdminLogin.body?.user?.role !== 'superadmin') {
    throw new Error('Superadmin login failed');
  }
  console.log('✅ Existing admin & superadmin logins working correctly.');

  // 2. Fetch or create an active RI Batch cohort
  let batchRes = await pool.query(`SELECT id, name FROM ri_batches WHERE status = 'active' ORDER BY id ASC LIMIT 1`);
  let batch1;
  if (batchRes.rowCount === 0) {
    const newB = await pool.query(`
      INSERT INTO ri_batches (name, source_program, panel_capacity, status, start_date, end_date)
      VALUES ('BATCH 1', 'RI_DIRECT', 60, 'active', '2026-10-13', '2026-10-19')
      RETURNING id, name
    `);
    batch1 = newB.rows[0];
  } else {
    batch1 = batchRes.rows[0];
  }
  console.log(`\nTesting with Batch 1: "${batch1.name}" (ID: ${batch1.id})`);

  let panelsRes = await pool.query(
    `SELECT id, panel_number, name FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC LIMIT 2`,
    [batch1.id]
  );
  if (panelsRes.rowCount < 2) {
    const p1 = await pool.query(`
      INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
      VALUES ($1, 1, 'PANEL 1', 60)
      RETURNING id, panel_number, name
    `, [batch1.id]);
    const p2 = await pool.query(`
      INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
      VALUES ($1, 2, 'PANEL 2', 60)
      RETURNING id, panel_number, name
    `, [batch1.id]);
    panelsRes = { rows: [p1.rows[0], p2.rows[0]] };
  }
  const panel1 = panelsRes.rows[0];
  const panel2 = panelsRes.rows[1] || panelsRes.rows[0];

  // Reset any previous village allocation on test panels to allow clean test runs
  await pool.query(`UPDATE ri_panels SET ri_village_id = NULL WHERE id IN ($1, $2)`, [panel1.id, panel2.id]);

  const adminToken = jwt.sign(
    { id: 1, email: 'admin@ltc.edu', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const timestamp = Date.now();
  const testNewEmail1 = `new.village.faculty.${timestamp}@mitwpu.edu.in`;
  const testExistingEmail2 = `existing.village.faculty.${timestamp}@mitwpu.edu.in`;
  const testNodalEmail = `nodal.village.officer.${timestamp}@mitwpu.edu.in`;

  // Pre-seed testExistingEmail2 with a custom password to verify it is NEVER overwritten
  const customPass = 'CustomPassword#2026!';
  const customHash = await bcrypt.hash(customPass, 10);
  await pool.query(`
    INSERT INTO users (name, email, password, role, department, designation, status)
    VALUES ('Pre-Existing Senior Prof', $1, $2, 'ri_faculty', 'Design', 'Professor', 'active')
    ON CONFLICT (email) DO NOTHING
  `, [testExistingEmail2, customHash]);

  // 3. Test Village & Faculty Import API with both new and existing faculty
  console.log('\n--- 2. Testing Village & Faculty Import with Accompany Faculty 1 & 2 Emails ---');
  const importPayload = {
    rows: [
      {
        panel: panel1.name,
        village_name: `Test Village Alpha ${timestamp}`,
        department: 'Design Department',
        nodal_officer_name: 'Dr. Nodal Coordinator',
        nodal_officer_email: testNodalEmail,
        accompany_faculty: [
          {
            role: 'Accompany Faculty 1',
            name: 'Prof. Brand New Accompany 1',
            email: testNewEmail1
          },
          {
            role: 'Accompany Faculty 2',
            name: 'Pre-Existing Senior Prof',
            email: testExistingEmail2
          }
        ]
      }
    ]
  };

  const importRes = await makeRequest('POST', `/api/ri/batches/${batch1.id}/village-faculty/import`, importPayload, adminToken);
  console.log('Import Status:', importRes.status);
  console.log('Import Response Summary:', importRes.body?.summary);

  if (importRes.status !== 200 || !importRes.body.success) {
    throw new Error('Village & Faculty import failed: ' + JSON.stringify(importRes.body));
  }
  console.log('✅ Village & Faculty Import succeeded.');

  // 4. Verify Database User Record & Password Hashing
  console.log('\n--- 3. Verifying User Table Record for Newly Provisioned Faculty ---');
  const userCheck1 = await pool.query(`SELECT id, email, password, role, department, status FROM users WHERE email = $1`, [testNewEmail1]);
  if (userCheck1.rowCount === 0) {
    throw new Error(`New faculty account ${testNewEmail1} was not created in users table!`);
  }
  const newUser = userCheck1.rows[0];
  const isDefaultMatch = await bcrypt.compare('faculty123', newUser.password);
  console.log(`User created: ID=${newUser.id}, Role=${newUser.role}, Status=${newUser.status}`);
  console.log(`Password matches default "faculty123": ${isDefaultMatch}`);
  if (!isDefaultMatch || newUser.role !== 'ri_faculty') {
    throw new Error('New user does not have expected default password hash or ri_faculty role');
  }
  console.log('✅ New faculty account has valid hashed password "faculty123" and role "ri_faculty".');

  // 5. Test Direct Login via POST /api/login for Newly Created Faculty
  console.log('\n--- 4. Testing Direct Login (POST /api/login) as Newly Created Faculty ---');
  const newLoginRes = await makeRequest('POST', '/api/login', {
    email: testNewEmail1,
    password: 'faculty123'
  });
  console.log('New Faculty Login Status:', newLoginRes.status);
  console.log('New Faculty User:', newLoginRes.body?.user?.email, 'role:', newLoginRes.body?.user?.role, 'is_ri_faculty:', newLoginRes.body?.user?.is_ri_faculty);
  if (newLoginRes.status !== 200 || !newLoginRes.body.token || newLoginRes.body.user?.role !== 'ri_faculty') {
    throw new Error('New faculty login failed: ' + JSON.stringify(newLoginRes.body));
  }
  const newFacultyToken = newLoginRes.body.token;
  console.log('✅ Newly created faculty logged in successfully and received JWT token.');

  // 6. Verify Existing Faculty Password Was NOT Overwritten
  console.log('\n--- 5. Verifying Existing Faculty Password Preservation ---');
  const existingLoginWithDefault = await makeRequest('POST', '/api/login', {
    email: testExistingEmail2,
    password: 'faculty123'
  });
  console.log('Login with default password should fail:', existingLoginWithDefault.status, existingLoginWithDefault.body?.message);
  if (existingLoginWithDefault.status === 200) {
    throw new Error('CRITICAL: Existing faculty password was overwritten with default password!');
  }

  const existingLoginWithCustom = await makeRequest('POST', '/api/login', {
    email: testExistingEmail2,
    password: customPass
  });
  console.log('Login with original custom password:', existingLoginWithCustom.status, existingLoginWithCustom.body?.user?.email);
  if (existingLoginWithCustom.status !== 200 || !existingLoginWithCustom.body.token) {
    throw new Error('Existing faculty login with original password failed!');
  }
  console.log('✅ Existing faculty password perfectly preserved.');

  // 7. Verify Faculty Workspace & Panel Linkage
  console.log('\n--- 6. Verifying Workspace Linkage (/api/ri/workspaces/my-assignments) ---');
  const wsRes = await makeRequest('GET', '/api/ri/workspaces/my-assignments', null, newFacultyToken);
  console.log('Workspace Status:', wsRes.status);
  console.log('Assignments Found:', wsRes.body?.faculty_assignments?.map(a => `${a.batch_name} - ${a.panel_name} (${a.village_name})`));
  if (wsRes.status !== 200 || !wsRes.body.faculty_assignments || wsRes.body.faculty_assignments.length === 0) {
    throw new Error('Faculty has no assignments in workspace API!');
  }
  console.log('✅ Faculty is linked to panel, village, and batch.');

  // 8. Test Repeated Upload (Idempotency - No Duplicate Accounts or Assignments)
  console.log('\n--- 7. Testing Repeated Upload Idempotency ---');
  const repeatRes = await makeRequest('POST', `/api/ri/batches/${batch1.id}/village-faculty/import`, importPayload, adminToken);
  console.log('Repeat Upload Status:', repeatRes.status);
  console.log('Repeat Accounts Created:', repeatRes.body?.summary?.accounts_created);
  console.log('Repeat Accounts Existed:', repeatRes.body?.summary?.accounts_existed);
  if (repeatRes.status !== 200 || repeatRes.body?.summary?.accounts_created !== 0) {
    throw new Error('Repeated upload created duplicate accounts!');
  }

  const userCountRes = await pool.query(`SELECT COUNT(*) FROM users WHERE email = $1`, [testNewEmail1]);
  if (parseInt(userCountRes.rows[0].count, 10) !== 1) {
    throw new Error(`Duplicate user account detected for ${testNewEmail1}`);
  }
  console.log('✅ Idempotency verified: 0 duplicate accounts created on re-upload.');

  // 9. Test Faculty Reuse Across Batches / Multiple Panels
  console.log('\n--- 8. Testing Faculty Reuse Across Different Panels / Batches ---');
  // Check if a second batch or second panel exists
  const secondPanelPayload = {
    rows: [
      {
        panel: panel2.name,
        village_name: `Test Village Beta ${timestamp}`,
        department: 'Design Department',
        nodal_officer_name: 'Dr. Nodal Coordinator',
        nodal_officer_email: testNodalEmail,
        accompany_faculty: [
          {
            role: 'Accompany Faculty 1',
            name: 'Prof. Brand New Accompany 1',
            email: testNewEmail1
          }
        ]
      }
    ]
  };

  const assignPanel2Res = await makeRequest('POST', `/api/ri/batches/${batch1.id}/village-faculty/import`, secondPanelPayload, adminToken);
  console.log('Panel 2 Assignment Status:', assignPanel2Res.status);
  console.log('Panel 2 Accounts Created (should be 0, reused):', assignPanel2Res.body?.summary?.accounts_created);
  console.log('Panel 2 Accounts Reused:', assignPanel2Res.body?.summary?.accounts_existed);

  // Check workspace again - should now have multiple assignments!
  const wsRes2 = await makeRequest('GET', '/api/ri/workspaces/my-assignments', null, newFacultyToken);
  console.log('Updated Assignments for Faculty:', wsRes2.body?.faculty_assignments?.map(a => `${a.batch_name} - ${a.panel_name} (${a.village_name})`));
  const assignments = wsRes2.body?.faculty_assignments || [];
  if (assignments.length < 2) {
    throw new Error('Faculty was not assigned to multiple panels/villages!');
  }
  console.log('✅ Faculty successfully reused across multiple panels/villages without account duplication.');

  console.log('\n================================================================');
  console.log('🎉 ALL TESTS PASSED: LOGIN API, PROVISIONING & REUSE VERIFIED!');
  console.log('================================================================\n');

  // Clean up test records
  await pool.query(`DELETE FROM users WHERE email IN ($1, $2, $3)`, [testNewEmail1, testExistingEmail2, testNodalEmail]);
  await pool.end();
}

run().catch(err => {
  console.error('\n❌ TEST RUNNER FAILURE:', err);
  process.exit(1);
});
