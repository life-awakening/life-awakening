const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

async function run() {
  console.log('=== TESTING RI FACULTY ACCOUNT PROVISIONING & LOGIN FLOW ===\n');

  // 1. Get an active RI Batch and Panels
  const batchRes = await pool.query(`SELECT id, name FROM ri_batches ORDER BY id ASC LIMIT 1`);
  if (batchRes.rowCount === 0) {
    console.error('No RI batch found!');
    process.exit(1);
  }
  const batch = batchRes.rows[0];
  console.log(`Testing with Batch: "${batch.name}" (ID: ${batch.id})`);

  const panelsRes = await pool.query(`SELECT id, panel_number, name FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC`, [batch.id]);
  const panel1 = panelsRes.rows[0];
  const panel2 = panelsRes.rows[1] || panelsRes.rows[0];

  const adminToken = jwt.sign(
    { id: 1, email: 'admin@college.edu', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const testEmail1 = `new.mentor.${Date.now()}@mitwpu.edu.in`;
  const testEmail2 = `existing.mentor.${Date.now()}@mitwpu.edu.in`;

  // Pre-seed testEmail2 in users with custom password
  const existingPasswordHash = await bcrypt.hash('CustomPassword999!', 10);
  await pool.query(`
    INSERT INTO users (name, email, password, role, department, designation, status)
    VALUES ('Pre Existing Mentor', $1, $2, 'ri_faculty', 'Science', 'Professor', 'active')
    ON CONFLICT (email) DO NOTHING
  `, [testEmail2, existingPasswordHash]);

  // Helper for HTTP requests
  function makePost(path, body, token = null) {
    return new Promise((resolve, reject) => {
      const dataStr = JSON.stringify(body);
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr)
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const req = http.request({
        hostname: 'localhost',
        port: 5001,
        path,
        method: 'POST',
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
      req.write(dataStr);
      req.end();
    });
  }

  // TEST 1: Bulk Upload with 1 New User + 1 Pre-existing User
  console.log('--- 1. Testing Bulk Import with Auto User Creation ---');
  const uploadPayload = {
    upload_mode: 'batch_wise',
    rows: [
      {
        name: 'Prof. Brand New Mentor',
        email: testEmail1,
        panel_input: `Panel ${panel1.panel_number}`,
        resolved_panel_id: panel1.id,
        phone: '9876543210',
        department: 'Engineering',
        designation: 'Assistant Professor',
        employee_id: 'NEW001',
        role: 'Mentor',
        is_valid: true
      },
      {
        name: 'Pre Existing Mentor',
        email: testEmail2,
        panel_input: `Panel ${panel2.panel_number}`,
        resolved_panel_id: panel2.id,
        phone: '9876543211',
        department: 'Science',
        designation: 'Professor',
        employee_id: 'EXT002',
        role: 'Lead Mentor',
        is_valid: true
      }
    ]
  };

  const uploadRes = await makePost(`/api/ri/batches/${batch.id}/faculty/bulk-upload`, uploadPayload, adminToken);
  console.log('Upload Status:', uploadRes.status);
  console.log('Upload Response:', uploadRes.body);

  if (uploadRes.status === 200 && uploadRes.body.accounts_created === 1 && uploadRes.body.accounts_existed === 1) {
    console.log('✅ TEST 1 PASSED: 1 new account created, 1 existing account matched.');
  } else {
    console.error('❌ TEST 1 FAILED:', uploadRes);
    process.exit(1);
  }

  // TEST 2: Verify Password Hashing in Database
  console.log('\n--- 2. Verifying Password Hashing in users Table ---');
  const userCheck1 = await pool.query(`SELECT id, email, password, role FROM users WHERE email = $1`, [testEmail1]);
  if (userCheck1.rowCount === 0) {
    console.error('❌ User not found in database!');
    process.exit(1);
  }
  const newUser = userCheck1.rows[0];
  const isMatch = await bcrypt.compare('faculty123', newUser.password);
  console.log(`User ID: ${newUser.id}, Role: ${newUser.role}`);
  console.log(`Password Hash starts with: ${newUser.password.substring(0, 7)}... Matches "faculty123": ${isMatch}`);

  if (isMatch && newUser.role === 'ri_faculty') {
    console.log('✅ TEST 2 PASSED: New user provisioned with role ri_faculty and hashed password "faculty123".');
  } else {
    console.error('❌ TEST 2 FAILED: Password or role does not match.');
    process.exit(1);
  }

  // TEST 3: Login as Newly Provisioned RI Faculty
  console.log('\n--- 3. Testing Direct Login via /api/login ---');
  const loginRes = await makePost('/api/login', {
    email: testEmail1,
    password: 'faculty123'
  });

  console.log('Login Status:', loginRes.status);
  console.log('Login User Payload:', loginRes.body?.user);

  if (loginRes.status === 200 && loginRes.body.token && loginRes.body.user?.role === 'ri_faculty') {
    console.log('✅ TEST 3 PASSED: Faculty successfully logged in with "faculty123" and received JWT token.');
  } else {
    console.error('❌ TEST 3 FAILED:', loginRes);
    process.exit(1);
  }

  const facultyJwt = loginRes.body.token;

  // TEST 4: Use Faculty JWT to Access Faculty Portal Profile & Panel
  console.log('\n--- 4. Testing Faculty Portal Access with Login Token ---');
  function makeGet(path, token) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 5001,
        path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let resp = '';
        res.on('data', d => resp += d);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(resp) }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  const profileRes = await makeGet('/api/ri/faculty-portal/profile', facultyJwt);
  console.log('Profile Status:', profileRes.status);
  console.log('Assigned Panels:', profileRes.body?.assigned_panels?.map(p => `P${p.panel_number}: ${p.panel_name}`));

  if (profileRes.status === 200 && profileRes.body.assigned_panels?.length === 1 && profileRes.body.assigned_panels[0].ri_panel_id === panel1.id) {
    console.log('✅ TEST 4 PASSED: Faculty has isolated access to assigned panel in the portal.');
  } else {
    console.error('❌ TEST 4 FAILED:', profileRes);
    process.exit(1);
  }

  // TEST 5: Upload again to verify idempotency (No Duplicate User Accounts)
  console.log('\n--- 5. Testing Re-Upload Idempotency (Zero Duplicate Accounts) ---');
  const reUploadRes = await makePost(`/api/ri/batches/${batch.id}/faculty/bulk-upload`, uploadPayload, adminToken);
  console.log('Re-upload Status:', reUploadRes.status);
  console.log('Re-upload Response:', reUploadRes.body);

  if (reUploadRes.status === 200 && reUploadRes.body.accounts_created === 0 && reUploadRes.body.accounts_existed === 2) {
    console.log('✅ TEST 5 PASSED: Re-upload created 0 duplicate accounts and updated existing assignments.');
  } else {
    console.error('❌ TEST 5 FAILED:', reUploadRes);
    process.exit(1);
  }

  console.log('\n🎉 ALL RI FACULTY ACCOUNT CREATION & LOGIN TESTS PASSED PERFECTLY!');
  await pool.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
