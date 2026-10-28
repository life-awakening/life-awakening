const http = require('http');
const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/db');

const API_BASE = 'http://localhost:5181';

function makeRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    let postData = null;
    if (body) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runLiveAudit() {
  console.log('================================================================');
  console.log('     LIVE HTTP/API SECURITY & FUNCTIONAL AUDIT TEST SUITE       ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Health check & Security headers
  total++;
  try {
    console.log('--- 1. Health Check & Security Headers ---');
    const res = await makeRequest('GET', '/api/health');
    assert.strictEqual(res.status, 200, `Health check status expected 200, got ${res.status}`);
    assert.strictEqual(res.data.status, 'ok', 'Status should be ok');
    
    // Check Helmet security headers
    assert(res.headers['x-content-type-options'] === 'nosniff', 'Missing X-Content-Type-Options: nosniff');
    assert(res.headers['strict-transport-security'], 'Missing Strict-Transport-Security header');
    assert(res.headers['x-frame-options'] === 'SAMEORIGIN', 'Missing X-Frame-Options: SAMEORIGIN');
    console.log('✔ PASS: Health check 200 OK and Helmet security headers verified');
    passed++;
  } catch (err) {
    console.error('✖ FAIL: Health check', err.message);
  }

  // 2. Auth: Empty credentials validation
  total++;
  try {
    console.log('\n--- 2. Auth: Empty Credentials Validation ---');
    const emptyRes = await makeRequest('POST', '/api/login', {});
    assert.strictEqual(emptyRes.status, 400, 'Empty login should return 400');
    assert(emptyRes.data.message.includes('required'), 'Should indicate required fields');

    const noPassRes = await makeRequest('POST', '/api/login', { email: 'admin@ltc.edu' });
    assert.strictEqual(noPassRes.status, 400, 'Missing password should return 400');
    console.log('✔ PASS: Login validation rejects empty email and empty password with 400');
    passed++;
  } catch (err) {
    console.error('✖ FAIL: Empty credentials validation', err.message);
  }

  // 3. Auth: Non-existent user
  total++;
  try {
    console.log('\n--- 3. Auth: Non-existent User Handling ---');
    const ghostRes = await makeRequest('POST', '/api/login', { email: 'nonexistent_ghost_user@example.com', password: 'Password123!' });
    assert.strictEqual(ghostRes.status, 400, 'Non-existent user should return 400');
    assert.strictEqual(ghostRes.data.message, 'User not found');
    console.log('✔ PASS: Non-existent user returns 400 "User not found"');
    passed++;
  } catch (err) {
    console.error('✖ FAIL: Non-existent user', err.message);
  }

  // 4. Auth: Invalid password
  total++;
  try {
    console.log('\n--- 4. Auth: Invalid Password Handling ---');
    const wrongPassRes = await makeRequest('POST', '/api/login', { email: 'admin@ltc.edu', password: 'WrongPassword999!' });
    assert.strictEqual(wrongPassRes.status, 400, 'Wrong password should return 400');
    assert.strictEqual(wrongPassRes.data.message, 'Invalid credentials');
    console.log('✔ PASS: Incorrect password returns 400 "Invalid credentials"');
    passed++;
  } catch (err) {
    console.error('✖ FAIL: Invalid password', err.message);
  }

  // 5. Auth & RBAC: Tokenless Protected Endpoint
  total++;
  try {
    console.log('\n--- 5. RBAC: Tokenless Request to Protected Endpoint ---');
    const noTokenRes = await makeRequest('GET', '/api/admin/batches');
    assert.strictEqual(noTokenRes.status, 401, 'Protected endpoint without token should return 401');
    assert.strictEqual(noTokenRes.data.message, 'No token provided');
    console.log('✔ PASS: Protected route strictly rejects tokenless request with 401 "No token provided"');
    passed++;
  } catch (err) {
    console.error('✖ FAIL: Tokenless protected endpoint', err.message);
  }

  // 6. RBAC: Invalid/Tampered Token
  total++;
  try {
    console.log('\n--- 6. RBAC: Tampered/Malformed Token ---');
    const badTokenRes = await makeRequest('GET', '/api/admin/batches', null, {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature'
    });
    assert.strictEqual(badTokenRes.status, 401, 'Tampered token should return 401');
    assert.strictEqual(badTokenRes.data.message, 'Invalid token');
    console.log('✔ PASS: Tampered token strictly rejected with 401 "Invalid token"');
    passed++;
  } catch (err) {
    console.error('✖ FAIL: Tampered token', err.message);
  }

  // 7. Test Admin Login and Admin Token Extraction
  let adminToken = null;
  total++;
  try {
    console.log('\n--- 7. Admin Login & Token Acquisition ---');
    const adminLoginRes = await makeRequest('POST', '/api/login', { email: 'admin@ltc.edu', password: 'Pppp0000@' });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login should succeed');
    assert(adminLoginRes.data.token, 'Response should contain JWT token');
    assert.strictEqual(adminLoginRes.data.user.role, 'admin');
    adminToken = adminLoginRes.data.token;
    console.log('✔ PASS: Admin login succeeded, role is "admin", valid JWT returned');
    passed++;
  } catch (err) {
    console.error('✖ FAIL: Admin login', err.message);
  }

  // 8. RBAC: Admin forbidden from Superadmin operations
  total++;
  try {
    console.log('\n--- 8. RBAC: Admin Role Escalation Attempt on Superadmin Route ---');
    if (adminToken) {
      const saUsersRes = await makeRequest('GET', '/api/superadmin/users', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(saUsersRes.status, 403, 'Admin attempting superadmin route should return 403');
      assert.strictEqual(saUsersRes.data.message, 'Unauthorized role');
      console.log('✔ PASS: Admin role strictly blocked from Superadmin endpoint with 403 "Unauthorized role"');
      passed++;
    } else {
      console.log('⚠ SKIP: Admin token not available');
    }
  } catch (err) {
    console.error('✖ FAIL: Admin role escalation', err.message);
  }

  // 9. Student Login using System Student ID Audit
  total++;
  try {
    console.log('\n--- 9. Student Login: System Student ID vs PRN ---');
    // Fetch a real student from DB
    const studentDb = await pool.query('SELECT id, name, prn, system_student_id, password FROM users WHERE role = \'student\' LIMIT 1');
    if (studentDb.rows.length > 0) {
      const s = studentDb.rows[0];
      console.log(`ℹ INFO: Testing student ID ${s.id} (${s.name}): system_student_id="${s.system_student_id}", prn="${s.prn}"`);
      
      // Test login with system_student_id
      const idLoginRes = await makeRequest('POST', '/api/login', {
        email: s.system_student_id,
        password: 'Password123!'
      });

      console.log(`ℹ INFO: Login attempt using system_student_id "${s.system_student_id}": Status ${idLoginRes.status}, Message: "${idLoginRes.data?.message}"`);
      if (idLoginRes.status === 400 && idLoginRes.data?.message === 'User not found') {
        console.log('❌ CONFIRMED DEFECT: Student login with system_student_id returns "User not found" because authController query only checks email, personal_email, and prn!');
      } else {
        console.log('✔ PASS: Student login with system_student_id handled');
        passed++;
      }
    }
  } catch (err) {
    console.error('✖ FAIL: Student ID login audit', err.message);
  }

  // 10. IDOR Test: Student Context Isolation
  total++;
  try {
    console.log('\n--- 10. Security: Student IDOR Protection Test ---');
    // Generate a temporary student token for Student 801
    const jwt = require('jsonwebtoken');
    const SECRET = process.env.JWT_SECRET;
    const token801 = jwt.sign({ id: 801, role: 'student', email: null }, SECRET, { expiresIn: '1h' });

    // Student 801 attempts to pass x-student-id: 803 to view another student's dashboard
    const idorRes = await makeRequest('GET', '/api/student/dashboard', null, {
      'Authorization': `Bearer ${token801}`,
      'x-student-id': '803'
    });

    assert.strictEqual(idorRes.status, 403, 'IDOR request should be blocked with 403');
    assert(idorRes.data.message.includes('Access denied'), 'Message should state access denied');
    console.log('✔ PASS: IDOR attempt strictly blocked! Student cannot access another student record via x-student-id');
    passed++;
  } catch (err) {
    console.error('✖ FAIL: IDOR test', err.message);
  }

  console.log('\n================================================================');
  console.log(`   LIVE AUDIT RESULTS: ${passed}/${total} TESTS PASSED    `);
  console.log('================================================================\n');

  process.exit(0);
}

runLiveAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
