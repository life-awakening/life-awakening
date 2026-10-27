/**
 * Verification Test Suite for Life Awakening PRN Duplicate Handling & updated_at Fixes
 */

const pool = require('../config/db');
const { processLifeAwakeningStudentUploadJob, detectTemplateType } = require('../controllers/adminController');
const bcrypt = require('bcryptjs');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function run() {
  console.log('=================================================================');
  console.log('STARTING SAFETY TESTS FOR PRN DUPLICATES & updated_at FIXES');
  console.log('=================================================================\n');

  // Helper to cleanup only test created users
  const cleanupTestRecords = async () => {
    await pool.query(`
      DELETE FROM parent_students 
      WHERE parent_id IN (SELECT id FROM users WHERE email LIKE '%@test-fix.internal' OR email LIKE '%@test-prn.internal')
         OR student_id IN (SELECT id FROM users WHERE email LIKE '%@test-fix.internal' OR email LIKE '%@test-prn.internal' OR name LIKE 'TEST_FIX_%');
      
      DELETE FROM users 
      WHERE email LIKE '%@test-fix.internal' 
         OR email LIKE '%@test-prn.internal' 
         OR name LIKE 'TEST_FIX_%';
    `);
  };

  await cleanupTestRecords();

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: New school student with blank PRN
    // ---------------------------------------------------------------------------
    console.log('--- TEST 1: New school student with blank PRN ---');
    const rowBlankPrn = [{
      'Student Full Name ': 'TEST_FIX_Blank_PRN',
      'Email Address1': 'parent.blank@test-fix.internal',
      'Class / Standard ': 'Class 6th',
      'Name of the School': 'Test Academy',
      'PRN/ Roll No.': '', // Blank PRN
      'Division': 'A',
      'Parent/Guardian Consent Confirmation': 'Yes'
    }];

    const res1 = await processLifeAwakeningStudentUploadJob(null, rowBlankPrn, null, 1, 'Admin', 'replace');
    assert(res1.success === true && res1.imported === 1 && res1.failed === 0, 'Blank PRN imported successfully without errors');

    const check1 = await pool.query("SELECT id, name, prn, roll_number FROM users WHERE name = 'TEST_FIX_Blank_PRN'");
    assert(check1.rows.length === 1, 'Blank PRN student record created');
    assert(check1.rows[0].prn === null, 'Student prn is null in database');
    assert(check1.rows[0].roll_number === null, 'Student roll_number is null in database');

    // ---------------------------------------------------------------------------
    // TEST 2: New school student with PRN already used by an LTC Member
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 2: School student with PRN already used by an LTC Member ---');
    const ltcPrn = 'LTC_MEMBER_PRN_999';
    // Create an LTC Member
    const ltcMemberRes = await pool.query(`
      INSERT INTO users (name, email, password, role, prn, status)
      VALUES ('TEST_FIX_Ltc_Member', 'ltc_member_prn@test-fix.internal', 'passhash', 'ltc_member', $1, 'active')
      RETURNING id, name, prn, role
    `, [ltcPrn]);
    const ltcMemberId = ltcMemberRes.rows[0].id;

    // Now upload a school student with the same PRN
    const rowLtcPrnCollision = [{
      'Student Full Name ': 'TEST_FIX_Student_Ltc_Collision',
      'Email Address1': 'parent.ltc.collision@test-fix.internal',
      'Class / Standard ': '7th',
      'Name of the School': 'School B',
      'PRN/ Roll No.': ltcPrn, // Collides with LTC Member
      'Division': 'B',
      'Parent/Guardian Consent Confirmation': 'Yes'
    }];

    const res2 = await processLifeAwakeningStudentUploadJob(null, rowLtcPrnCollision, null, 1, 'Admin', 'replace');
    assert(res2.success === true && res2.imported === 1 && res2.failed === 0, 'Imported successfully without users_prn_key constraint violation');

    // Verify LTC Member record is completely untouched
    const ltcCheck = await pool.query("SELECT id, name, prn, role FROM users WHERE id = $1", [ltcMemberId]);
    assert(ltcCheck.rows[0].name === 'TEST_FIX_Ltc_Member' && ltcCheck.rows[0].prn === ltcPrn, 'LTC Member record remains completely untouched and not overwritten');

    // Verify school student has roll_number preserved and prn set to null
    const studentLtcCheck = await pool.query("SELECT id, name, prn, roll_number FROM users WHERE name = 'TEST_FIX_Student_Ltc_Collision'");
    assert(studentLtcCheck.rows[0].roll_number === ltcPrn, 'Classroom roll number preserved in roll_number column');
    assert(studentLtcCheck.rows[0].prn === null, 'Colliding PRN left null in prn column to prevent constraint violation');
    assert(res2.errors.some(e => e.error.includes('already assigned to "TEST_FIX_Ltc_Member"')), 'Informative notice logged in error list');

    // ---------------------------------------------------------------------------
    // TEST 3: New school student with PRN already used by another school student
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 3: School student with PRN already used by another school student ---');
    const sharedRollNo = 'ROLL_777';
    // Student A
    const rowStudentA = [{
      'Student Full Name ': 'TEST_FIX_Student_A',
      'Email Address1': 'parent.a@test-fix.internal',
      'Class / Standard ': '8th',
      'Name of the School': 'School Alpha',
      'PRN/ Roll No.': sharedRollNo,
      'Parent/Guardian Consent Confirmation': 'Yes'
    }];
    const res3a = await processLifeAwakeningStudentUploadJob(null, rowStudentA, null, 1, 'Admin', 'replace');
    assert(res3a.imported === 1, 'Student A imported with initial PRN');

    const checkStudentA = await pool.query("SELECT id, prn, roll_number FROM users WHERE name = 'TEST_FIX_Student_A'");
    assert(checkStudentA.rows[0].prn === sharedRollNo, 'Student A owns PRN in database');

    // Student B in another school/class with SAME classroom roll number
    const rowStudentB = [{
      'Student Full Name ': 'TEST_FIX_Student_B',
      'Email Address1': 'parent.b@test-fix.internal',
      'Class / Standard ': '9th',
      'Name of the School': 'School Beta',
      'PRN/ Roll No.': sharedRollNo, // Collides with Student A
      'Parent/Guardian Consent Confirmation': 'Yes'
    }];
    const res3b = await processLifeAwakeningStudentUploadJob(null, rowStudentB, null, 1, 'Admin', 'replace');
    assert(res3b.imported === 1 && res3b.failed === 0, 'Student B imported successfully without crashing on users_prn_key');

    const checkStudentB = await pool.query("SELECT id, prn, roll_number FROM users WHERE name = 'TEST_FIX_Student_B'");
    assert(checkStudentB.rows[0].roll_number === sharedRollNo, 'Student B classroom roll number preserved in roll_number');
    assert(checkStudentB.rows[0].prn === null, 'Student B prn left null to avoid collision');

    // Verify Student A was not merged or modified
    const recheckStudentA = await pool.query("SELECT id, name, prn, roll_number FROM users WHERE name = 'TEST_FIX_Student_A'");
    assert(recheckStudentA.rows[0].id === checkStudentA.rows[0].id && recheckStudentA.rows[0].prn === sharedRollNo, 'Student A was not merged or overwritten by Student B');

    // ---------------------------------------------------------------------------
    // TEST 4: Re-import of the same student (with duplicateAction = replace) -> verifies updated_at fix
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 4: Re-import of existing student (verifying updated_at fix) ---');
    const rowStudentUpdate = [{
      'Student Full Name ': 'TEST_FIX_Student_A',
      'Email Address1': 'parent.a@test-fix.internal',
      'Class / Standard ': '8th',
      'Name of the School': 'School Alpha Updated Branch',
      'PRN/ Roll No.': sharedRollNo,
      'Residential Address ': 'New Updated Address 123',
      'Parent/Guardian Consent Confirmation': 'Yes'
    }];
    const res4 = await processLifeAwakeningStudentUploadJob(null, rowStudentUpdate, null, 1, 'Admin', 'replace');
    assert(res4.imported === 1 && res4.failed === 0, 'Re-import with replace succeeded with 0 failures (no updated_at column error)');

    const updatedCheck = await pool.query("SELECT id, school, address, prn FROM users WHERE name = 'TEST_FIX_Student_A'");
    assert(updatedCheck.rows[0].school === 'School Alpha Updated Branch', 'Student details updated cleanly');
    assert(updatedCheck.rows[0].address === 'New Updated Address 123', 'Updated address saved');
    assert(updatedCheck.rows[0].prn === sharedRollNo, 'Student own PRN preserved on update');

    // ---------------------------------------------------------------------------
    // TEST 5: Two siblings sharing the same parent email
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 5: Two siblings sharing same parent email ---');
    const sharedParentEmail = 'mom.siblings@test-fix.internal';
    const siblingRows = [
      {
        'Student Full Name ': 'TEST_FIX_Sibling_1',
        'Email Address1': sharedParentEmail,
        'Class / Standard ': '6th',
        'Name of the School': 'Sibling School',
        'PRN/ Roll No.': '15',
        'Parent/Guardian Consent Confirmation': 'Yes'
      },
      {
        'Student Full Name ': 'TEST_FIX_Sibling_2',
        'Email Address1': sharedParentEmail,
        'Class / Standard ': '10th',
        'Name of the School': 'Sibling School',
        'PRN/ Roll No.': '16',
        'Parent/Guardian Consent Confirmation': 'Yes'
      }
    ];

    const res5 = await processLifeAwakeningStudentUploadJob(null, siblingRows, null, 1, 'Admin', 'replace');
    assert(res5.imported === 2 && res5.failed === 0, 'Both siblings imported cleanly');

    const parentCheck = await pool.query("SELECT id, email, role FROM users WHERE email = $1", [sharedParentEmail]);
    assert(parentCheck.rows.length === 1, 'Exactly one parent account created for shared email');

    const parentId = parentCheck.rows[0].id;
    const linksCheck = await pool.query("SELECT student_id FROM parent_students WHERE parent_id = $1", [parentId]);
    assert(linksCheck.rows.length === 2, 'Parent account linked to both sibling student records in parent_students');

    // ---------------------------------------------------------------------------
    // TEST 6: Existing parent account with an existing password
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 6: Existing parent account password preservation ---');
    const existingParentEmail = 'dad.custom.password@test-fix.internal';
    const customPasswordHash = await bcrypt.hash('CustomParentSecret2026!', 10);
    const preCreatedParent = await pool.query(`
      INSERT INTO users (name, email, password, role, status)
      VALUES ('Existing Dad', $1, $2, 'parent', 'active')
      RETURNING id, password
    `, [existingParentEmail, customPasswordHash]);

    const rowWithPreExistingParent = [{
      'Student Full Name ': 'TEST_FIX_Child_Of_Existing_Parent',
      'Email Address1': existingParentEmail,
      'Class / Standard ': '7th',
      'Name of the School': 'Dad School',
      'PRN/ Roll No.': '17',
      'Parent/Guardian Consent Confirmation': 'Yes'
    }];

    const res6 = await processLifeAwakeningStudentUploadJob(null, rowWithPreExistingParent, null, 1, 'Admin', 'replace');
    assert(res6.imported === 1 && res6.failed === 0, 'Child of existing parent created');

    const dadCheck = await pool.query("SELECT id, password FROM users WHERE id = $1", [preCreatedParent.rows[0].id]);
    assert(dadCheck.rows[0].password === customPasswordHash, 'Pre-existing parent password hash is 100% preserved and not overwritten');

    // ---------------------------------------------------------------------------
    // TEST 7: Legacy LTC Member template detection and PRN preservation
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 7: Legacy LTC Member template detection ---');
    const legacyLtcHeaders = ['Full Name', 'Email (Official)', 'Contact Number', 'PRN', 'Role'];
    const schoolHeaders = ['Timestamp', 'Email Address1', 'Student Full Name ', 'Class / Standard ', 'PRN/ Roll No.'];

    assert(detectTemplateType(schoolHeaders) === 'life_awakening_student', 'detectTemplateType detects life_awakening_student for school headers');
    assert(detectTemplateType(legacyLtcHeaders) !== 'life_awakening_student', 'detectTemplateType does NOT route legacy LTC headers to school importer');

    // ---------------------------------------------------------------------------
    // TEST 8: Full schema compatibility for all INSERT & UPDATE statements
    // ---------------------------------------------------------------------------
    console.log('\n--- TEST 8: Verify users table schema compatibility ---');
    const colsRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    const dbCols = colsRes.rows.map(c => c.column_name);
    assert(!dbCols.includes('updated_at'), 'Confirmed users table intentionally has no updated_at column');
    assert(dbCols.includes('roll_number'), 'users table has roll_number column for classroom roll numbers');
    assert(dbCols.includes('prn'), 'users table has prn column');
    assert(dbCols.includes('password'), 'users table has password column');

  } finally {
    // Clean up all test-generated records
    await cleanupTestRecords();
    console.log('\nTest cleanup completed.');
  }

  console.log('\n=================================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
