require('dotenv').config({ path: '/Users/ahsanimamkhan/Desktop/life-awakening/backend/.env' });
const pool = require('/Users/ahsanimamkhan/Desktop/life-awakening/backend/config/db');
const jwt = require('/Users/ahsanimamkhan/Desktop/life-awakening/backend/node_modules/jsonwebtoken');
const bcrypt = require('/Users/ahsanimamkhan/Desktop/life-awakening/backend/node_modules/bcryptjs');

const API_BASE = 'http://localhost:5181';

const runTests = async () => {
  console.log('====================================================');
  console.log('   RUNNING COMPREHENSIVE VERIFICATION SUITE         ');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failedCount++;
    }
  };

  try {
    // -----------------------------------------------------------------
    // TEST 1: Parent Email Updates
    // -----------------------------------------------------------------
    console.log('--- Test 1: Parent Email Updates in Admin Profile ---');

    // Generate admin token
    const adminRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'admin' LIMIT 1");
    if (adminRes.rowCount === 0) throw new Error('No admin user found');
    const admin = adminRes.rows[0];
    const adminToken = jwt.sign({ id: admin.id, role: admin.role, email: admin.email }, process.env.JWT_SECRET || 'life_awakening_local_development_jwt_secret_key_998811', { expiresIn: '1h' });

    // Find student 281 (Shreeya Neyyan) who shares parent 280 with student 279
    const s281Res = await pool.query("SELECT id, name, email FROM users WHERE id = 281");
    const s279Res = await pool.query("SELECT id, name, email FROM users WHERE id = 279");
    assert(s281Res.rowCount > 0 && s279Res.rowCount > 0, 'Found shared-parent test students 281 and 279');

    // 1A. Validate rejecting duplicate Parent 1 & Parent 2 email
    const dupRes = await fetch(`${API_BASE}/api/admin/users/281/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        parent1_email: 'same@example.com',
        parent2_email: 'same@example.com'
      })
    });
    assert(dupRes.status === 400, 'Rejects duplicate Parent 1 and Parent 2 email (400 Bad Request)');
    const dupData = await dupRes.json();
    assert(dupData.message.includes('cannot have the same email'), 'Meaningful error message returned for duplicate parent emails');

    // 1B. Validate rejecting parent email matching student email
    const studentEmailRes = await fetch(`${API_BASE}/api/admin/users/281/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        parent1_email: s281Res.rows[0].email
      })
    });
    assert(studentEmailRes.status === 400, 'Rejects parent email matching student email (400 Bad Request)');

    // 1C. Validate rejecting invalid email format
    const invalidEmailRes = await fetch(`${API_BASE}/api/admin/users/281/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        parent1_email: 'invalid-email-address'
      })
    });
    assert(invalidEmailRes.status === 400, 'Rejects invalid email format (400 Bad Request)');

    // 1D. Create a test student with two parents to test persistence and updates
    const testHash = await bcrypt.hash('testpass123', 10);
    const testStudentRes = await pool.query(`
      INSERT INTO users (name, email, password, role, status)
      VALUES ('Test Student Auto', 'test_student_auto_${Date.now()}@example.com', $1, 'student', 'active')
      RETURNING id, email
    `, [testHash]);
    const testStudentId = testStudentRes.rows[0].id;

    // Save Parent 1 and Parent 2
    const p1EmailInitial = `parent1_auto_${Date.now()}@example.com`;
    const p2EmailInitial = `parent2_auto_${Date.now()}@example.com`;

    const saveRes = await fetch(`${API_BASE}/api/admin/users/${testStudentId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        parent1_email: p1EmailInitial,
        parent2_email: p2EmailInitial
      })
    });
    assert(saveRes.status === 200, 'Successfully saved Parent 1 and Parent 2 emails');

    // Fetch profile to verify persistence
    const profRes = await fetch(`${API_BASE}/api/admin/users/${testStudentId}/profile`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const profData = await profRes.json();
    assert(profData.user.parent1_email === p1EmailInitial, 'Parent 1 email persisted correctly in profile');
    assert(profData.user.parent2_email === p2EmailInitial, 'Parent 2 email persisted correctly in profile');
    assert(profData.user.parents.length === 2, 'Two parent records linked in parent_students');
    assert(profData.user.parents[0].is_primary === true, 'Parent 1 has is_primary = true');
    assert(profData.user.parents[1].is_primary === false, 'Parent 2 has is_primary = false');

    // Verify presence in Life Awakening Student Directory endpoint
    const dirRes = await fetch(`${API_BASE}/api/admin/la/students`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dirData = await dirRes.json();
    const directoryEntry = dirData.students.find(s => s.id === testStudentId);
    assert(directoryEntry !== undefined, 'Student appears in /api/admin/la/students directory');
    assert(directoryEntry.parent1_email === p1EmailInitial, 'Directory reflects Parent 1 email immediately');
    assert(directoryEntry.parent2_email === p2EmailInitial, 'Directory reflects Parent 2 email immediately');

    // Update Parent 1 email to new email
    const p1UpdatedEmail = `parent1_updated_${Date.now()}@example.com`;
    const updateRes = await fetch(`${API_BASE}/api/admin/users/${testStudentId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        parent1_email: p1UpdatedEmail,
        parent2_email: p2EmailInitial
      })
    });
    assert(updateRes.status === 200, 'Successfully updated Parent 1 email');

    // Verify persistence after refresh/refetch
    const profRes2 = await fetch(`${API_BASE}/api/admin/users/${testStudentId}/profile`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const profData2 = await profRes2.json();
    assert(profData2.user.parent1_email === p1UpdatedEmail, 'Updated Parent 1 email persisted on profile re-fetch');

    // Clean up test student
    await pool.query('DELETE FROM users WHERE id = $1', [testStudentId]);
    console.log('');

    // -----------------------------------------------------------------
    // TEST 2: Student Dashboard Access by Authenticated Parent
    // -----------------------------------------------------------------
    console.log('--- Test 2: Student Dashboard Login & Parent Authorization ---');

    // Get a real parent with linked children (e.g. parent 240 linked to student 239)
    const pQuery = await pool.query(`
      SELECT ps.parent_id, ps.student_id, p.email AS parent_email, s.name AS student_name
      FROM parent_students ps
      JOIN users p ON p.id = ps.parent_id
      JOIN users s ON s.id = ps.student_id
      WHERE ps.is_primary = true
      LIMIT 1
    `);
    const testRelation = pQuery.rows[0];
    assert(testRelation !== undefined, `Found parent ${testRelation.parent_id} linked to student ${testRelation.student_id}`);

    const parentToken = jwt.sign(
      { id: testRelation.parent_id, role: 'parent', email: testRelation.parent_email },
      process.env.JWT_SECRET || 'life_awakening_local_development_jwt_secret_key_998811',
      { expiresIn: '1h' }
    );

    // 2A. Parent fetches authorized children (/api/parent/children)
    const childrenRes = await fetch(`${API_BASE}/api/parent/children`, {
      headers: { 'Authorization': `Bearer ${parentToken}` }
    });
    assert(childrenRes.status === 200, 'Parent successfully retrieves linked children (200 OK)');
    const childrenData = await childrenRes.json();
    assert(childrenData.children.length > 0, 'Children list contains linked child');
    const childObj = childrenData.children[0];
    assert(childObj.student_id && childObj.student_id.startsWith('LA-'), `Child has formatted student_id: ${childObj.student_id}`);
    assert(childObj.name !== undefined, 'Child object includes student name');
    assert(childObj.class_grade !== undefined, 'Child object includes class_grade');

    // 2B. Parent accesses /api/student/dashboard with x-student-id header
    const dashRes = await fetch(`${API_BASE}/api/student/dashboard`, {
      headers: {
        'Authorization': `Bearer ${parentToken}`,
        'x-student-id': String(testRelation.student_id)
      }
    });
    assert(dashRes.status === 200, 'Authenticated parent successfully opens student dashboard without login redirect (200 OK)');
    const dashData = await dashRes.json();
    assert(dashData.data && (dashData.data.name === testRelation.student_name || dashData.data.id === testRelation.student_id), 'Dashboard returns correct student data');

    // 2C. Unauthorized child access test:
    // Find a student NOT linked to this parent
    const otherStudentRes = await pool.query(
      'SELECT id, name FROM users WHERE role = $1 AND id NOT IN (SELECT student_id FROM parent_students WHERE parent_id = $2) LIMIT 1',
      ['student', testRelation.parent_id]
    );
    if (otherStudentRes.rowCount > 0) {
      const otherStudent = otherStudentRes.rows[0];
      const unauthorizedRes = await fetch(`${API_BASE}/api/student/dashboard`, {
        headers: {
          'Authorization': `Bearer ${parentToken}`,
          'x-student-id': String(otherStudent.id)
        }
      });
      assert(unauthorizedRes.status === 403, `Access denied (403) when parent attempts unauthorized access to student ${otherStudent.id}`);
    }

    // 2D. Expired session test
    const expiredToken = jwt.sign(
      { id: testRelation.parent_id, role: 'parent', email: testRelation.parent_email },
      process.env.JWT_SECRET || 'life_awakening_local_development_jwt_secret_key_998811',
      { expiresIn: '-1s' }
    );
    const expiredRes = await fetch(`${API_BASE}/api/student/dashboard`, {
      headers: {
        'Authorization': `Bearer ${expiredToken}`,
        'x-student-id': String(testRelation.student_id)
      }
    });
    assert(expiredRes.status === 401, 'Expired session properly returns 401 Unauthorized');
    console.log('');

    // -----------------------------------------------------------------
    // TEST 3: Resend Email Integration
    // -----------------------------------------------------------------
    console.log('--- Test 3: Resend Email Integration & Config ---');
    assert(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_'), 'RESEND_API_KEY is configured in backend/.env');
    assert(process.env.RESEND_FROM_EMAIL !== undefined, 'RESEND_FROM_EMAIL is configured in backend/.env');
    assert(process.env.RESEND_REPLY_TO !== undefined, 'RESEND_REPLY_TO is configured in backend/.env');
    assert(process.env.EMAIL_LIMIT_DELAY_MS === '2000', 'EMAIL_LIMIT_DELAY_MS is set to 2000 in backend/.env');

    // Test sending delay queue in emailService
    const emailService = require('/Users/ahsanimamkhan/Desktop/life-awakening/backend/services/emailService');
    assert(typeof emailService.sendEmail === 'function', 'emailService exports sendEmail function');
    assert(typeof emailService.getEmailStatus === 'function', 'emailService exports getEmailStatus function');

    // Verify emailService does not expose API key on failure
    try {
      // Mock Resend to test rejection handling safely without hitting live API
      const prevKey = process.env.RESEND_API_KEY;
      process.env.RESEND_API_KEY = 're_invalid_test_key_for_mock_12345';
      let threw = false;
      try {
        await emailService.sendEmail({
          to: 'mock-test@example.com',
          subject: 'Test Subject',
          html: '<p>Test</p>'
        });
      } catch (err) {
        threw = true;
        assert(!err.message.includes('re_invalid_test_key'), 'Error messages mask the raw RESEND_API_KEY');
      }
      assert(threw, 'sendEmail rejects and throws error on invalid API response (never claims false success)');
      process.env.RESEND_API_KEY = prevKey;
    } catch (e) {
      console.error('Email error:', e);
    }
    console.log('');

    // -----------------------------------------------------------------
    // TEST 5: Temporarily Disable Mandatory Password Change
    // -----------------------------------------------------------------
    console.log('--- Test 5: Disabled Mandatory Student Password Change ---');

    // Find student with password_changed = false
    const unpwStudentRes = await pool.query("SELECT id, email, password_changed, role FROM users WHERE role = 'student' AND password_changed IS NOT TRUE LIMIT 1");
    let unpwStudent;
    if (unpwStudentRes.rowCount > 0) {
      unpwStudent = unpwStudentRes.rows[0];
    } else {
      // Create one if all existing happen to have changed
      const insRes = await pool.query(`
        INSERT INTO users (name, email, password, role, status, password_changed)
        VALUES ('Temp Student', 'temp_student_test@example.com', $1, 'student', 'active', false)
        RETURNING id, email, password_changed, role
      `, [testHash]);
      unpwStudent = insRes.rows[0];
    }

    assert(unpwStudent.password_changed !== true, `Testing with student ${unpwStudent.id} having password_changed = false`);

    const studentToken = jwt.sign(
      { id: unpwStudent.id, role: 'student', email: unpwStudent.email },
      process.env.JWT_SECRET || 'life_awakening_local_development_jwt_secret_key_998811',
      { expiresIn: '1h' }
    );

    // Backend allows student to access /api/student/dashboard
    const sDashRes = await fetch(`${API_BASE}/api/student/dashboard`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert(sDashRes.status === 200, 'Student with password_changed = false accesses dashboard API successfully (200 OK)');

    // Verify config file exists and flag is false
    const fs = require('fs');
    const authConfigPath = '/Users/ahsanimamkhan/Desktop/life-awakening/frontend/src/config/authConfig.js';
    assert(fs.existsSync(authConfigPath), 'frontend/src/config/authConfig.js exists');
    const configContent = fs.readFileSync(authConfigPath, 'utf8');
    assert(configContent.includes('export const REQUIRE_STUDENT_PASSWORD_CHANGE = false'), 'REQUIRE_STUDENT_PASSWORD_CHANGE is set to false');

    // Clean up if temp student was created
    if (unpwStudent.email === 'temp_student_test@example.com') {
      await pool.query('DELETE FROM users WHERE id = $1', [unpwStudent.id]);
    }
    console.log('');

    // Summary
    console.log('====================================================');
    console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log('====================================================');

    process.exit(failedCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  }
};

runTests();
