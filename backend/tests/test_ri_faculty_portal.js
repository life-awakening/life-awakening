const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

async function run() {
  console.log('=== RUNNING PRODUCTION RI FACULTY PORTAL E2E TESTS ===\n');

  // 1. Get an active RI Batch, panels, and faculty
  const facultyRes = await pool.query(`
    SELECT rbf.*, rp.panel_number, rp.name as panel_name, rb.name as batch_name 
    FROM ri_batch_faculty rbf
    JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
    JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
    WHERE rbf.status <> 'deleted' AND rbf.email IS NOT NULL AND rbf.email <> ''
    LIMIT 2
  `);

  if (facultyRes.rowCount === 0) {
    console.error('No faculty records found in ri_batch_faculty. Please run faculty upload test first.');
    process.exit(1);
  }

  const assignedFaculty1 = facultyRes.rows[0];
  const assignedFaculty2 = facultyRes.rows[1] || facultyRes.rows[0];

  console.log(`Testing with Assigned RI Faculty: "${assignedFaculty1.name}" (${assignedFaculty1.email})`);
  console.log(` - Assigned to Panel ID ${assignedFaculty1.ri_panel_id} (P${assignedFaculty1.panel_number}: ${assignedFaculty1.panel_name}) in "${assignedFaculty1.batch_name}"\n`);

  // Find an unassigned panel
  const otherPanelsRes = await pool.query(`
    SELECT id, panel_number, name FROM ri_panels 
    WHERE id <> $1 AND ri_batch_id = $2 
    LIMIT 1
  `, [assignedFaculty1.ri_panel_id, assignedFaculty1.ri_batch_id]);
  const unauthorizedPanel = otherPanelsRes.rows[0] || null;

  // 2. Generate Tokens
  const facultyToken = jwt.sign(
    { id: 9991, email: assignedFaculty1.email, role: 'ri_faculty' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const unassignedUserToken = jwt.sign(
    { id: 9999, email: 'unassigned.person@college.edu', role: 'ri_faculty' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Helper function for API requests
  function makeRequest(path, token) {
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
      req.end();
    });
  }

  // TEST 1: Security & Isolation - Unassigned user access blocked
  console.log('--- 1. Testing Security: Unassigned User Access ---');
  const test1 = await makeRequest('/api/ri/faculty-portal/profile', unassignedUserToken);
  console.log(`Status: ${test1.status} (Expected: 403)`);
  if (test1.status === 403) {
    console.log('✅ TEST 1 PASSED: Unassigned users are strictly blocked with 403 Forbidden.');
  } else {
    console.error('❌ TEST 1 FAILED:', test1);
    process.exit(1);
  }

  // TEST 2: Profile & Assigned Panels retrieval
  console.log('\n--- 2. Testing Profile & Assigned Panels Retrieval ---');
  const test2 = await makeRequest('/api/ri/faculty-portal/profile', facultyToken);
  console.log(`Status: ${test2.status}, Faculty Name: ${test2.body?.faculty?.name}, Total Panels: ${test2.body?.total_panels}`);
  if (test2.status === 200 && test2.body?.assigned_panels?.length >= 1) {
    console.log('✅ TEST 2 PASSED: Faculty profile and assigned panel retrieved successfully.');
  } else {
    console.error('❌ TEST 2 FAILED:', test2);
    process.exit(1);
  }

  // TEST 3: Dashboard Overview for Assigned Panel
  console.log('\n--- 3. Testing Dashboard Overview for Assigned Panel ---');
  const test3 = await makeRequest(`/api/ri/faculty-portal/dashboard?panel_id=${assignedFaculty1.ri_panel_id}`, facultyToken);
  console.log(`Status: ${test3.status}, Panel: P${test3.body?.panel?.panel_number} (${test3.body?.panel?.panel_name})`);
  console.log(`Total Students: ${test3.body?.statistics?.total_students}, Mentors Count: ${test3.body?.mentors?.length}`);
  if (test3.status === 200 && test3.body?.panel && test3.body?.statistics) {
    console.log('✅ TEST 3 PASSED: Faculty dashboard data loaded with statistics and co-mentors.');
  } else {
    console.error('❌ TEST 3 FAILED:', test3);
    process.exit(1);
  }

  // TEST 4: Security - Unauthorized Panel Access Prevention
  if (unauthorizedPanel) {
    console.log('\n--- 4. Testing Security: Unauthorized Panel Access Prevention ---');
    const test4 = await makeRequest(`/api/ri/faculty-portal/dashboard?panel_id=${unauthorizedPanel.id}`, facultyToken);
    console.log(`Status: ${test4.status} (Expected: 403)`);
    if (test4.status === 403) {
      console.log(`✅ TEST 4 PASSED: Faculty blocked from accessing non-assigned panel P${unauthorizedPanel.panel_number}.`);
    } else {
      console.error('❌ TEST 4 FAILED:', test4);
      process.exit(1);
    }
  }

  // TEST 5: My Panel Detailed View (Village & Student Roster)
  console.log('\n--- 5. Testing My Panel Detailed View ---');
  const test5 = await makeRequest(`/api/ri/faculty-portal/panel?panel_id=${assignedFaculty1.ri_panel_id}`, facultyToken);
  console.log(`Status: ${test5.status}, Village: ${test5.body?.village?.name}, Students: ${test5.body?.total_students}`);
  if (test5.status === 200 && test5.body?.village && Array.isArray(test5.body?.students)) {
    console.log('✅ TEST 5 PASSED: My Panel details and student roster loaded.');
  } else {
    console.error('❌ TEST 5 FAILED:', test5);
    process.exit(1);
  }

  // TEST 6: Searchable Panel Students Directory
  console.log('\n--- 6. Testing Panel Students Directory ---');
  const test6 = await makeRequest(`/api/ri/faculty-portal/students?panel_id=${assignedFaculty1.ri_panel_id}`, facultyToken);
  console.log(`Status: ${test6.status}, Enrolled Students: ${test6.body?.total}`);
  if (test6.status === 200 && Array.isArray(test6.body?.students)) {
    console.log('✅ TEST 6 PASSED: Panel students directory retrieved.');
  } else {
    console.error('❌ TEST 6 FAILED:', test6);
    process.exit(1);
  }

  // TEST 7: Activities & Evaluation Rubrics
  console.log('\n--- 7. Testing Activities & Evaluation Rubrics ---');
  const test7 = await makeRequest('/api/ri/faculty-portal/activities', facultyToken);
  console.log(`Status: ${test7.status}, Total Marks: ${test7.body?.total_marks}, Modules: ${test7.body?.evaluation_modules?.length}`);
  if (test7.status === 200 && test7.body?.total_marks === 100 && test7.body?.evaluation_modules?.length === 4) {
    console.log('✅ TEST 7 PASSED: 100-mark evaluation framework & rubrics verified.');
  } else {
    console.error('❌ TEST 7 FAILED:', test7);
    process.exit(1);
  }

  // TEST 8: 5-Day Immersion Schedule
  console.log('\n--- 8. Testing 5-Day Immersion Schedule ---');
  const test8 = await makeRequest('/api/ri/faculty-portal/schedule', facultyToken);
  console.log(`Status: ${test8.status}, Schedule Days: ${test8.body?.schedule?.length}`);
  if (test8.status === 200 && test8.body?.schedule?.length === 5) {
    console.log('✅ TEST 8 PASSED: Complete 5-day immersion timetable retrieved.');
  } else {
    console.error('❌ TEST 8 FAILED:', test8);
    process.exit(1);
  }

  console.log('\n🎉 ALL RI FACULTY PORTAL TESTS PASSED PERFECTLY!');
  await pool.end();
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
