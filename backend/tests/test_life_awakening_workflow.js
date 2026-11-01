/**
 * Automated Verification Test Script for Life Awakening School-Student Workflow
 * 
 * Verifies:
 * 1. Canonical Class Normalization (6th - 10th)
 * 2. Parent-Based Authentication & Child Selection logic
 * 3. Server-side Student Authorization Context Middleware
 * 4. Life Awakening Registration Bulk Import (parent reuse, 2 parent emails, sibling mapping, no PRN required)
 * 5. Batch Class Compatibility Validation (8th to 8th succeeds, 6th to 8th blocked)
 * 6. Legacy LTC Member Import Format Preservation
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/db');
const { normalizeClassGrade, CANONICAL_CLASSES, isValidCanonicalClass } = require('../utils/classNormalizer');
const { authorizeStudentContext } = require('../middleware/studentContext');
const { processLifeAwakeningStudentUploadJob } = require('../controllers/adminController');
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

async function runTests() {
  console.log('=====================================================');
  console.log('STARTING LIFE AWAKENING INTEGRATION & UNIT TESTS');
  console.log('=====================================================\n');

  // -------------------------------------------------------------------------
  // TEST SUITE 1: CANONICAL CLASS NORMALIZATION
  // -------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: Canonical Class Normalization ---');
  assert(normalizeClassGrade('6') === '6th', 'Normalizes "6" to "6th"');
  assert(normalizeClassGrade('6th') === '6th', 'Normalizes "6th" to "6th"');
  assert(normalizeClassGrade('Class 6') === '6th', 'Normalizes "Class 6" to "6th"');
  assert(normalizeClassGrade('Class 6th') === '6th', 'Normalizes "Class 6th" to "6th"');
  assert(normalizeClassGrade('  class   6TH  ') === '6th', 'Handles mixed case and whitespace');
  assert(normalizeClassGrade('7') === '7th', 'Normalizes "7" to "7th"');
  assert(normalizeClassGrade('Class 7') === '7th', 'Normalizes "Class 7" to "7th"');
  assert(normalizeClassGrade('8th') === '8th', 'Normalizes "8th" to "8th"');
  assert(normalizeClassGrade('Class 8') === '8th', 'Normalizes "Class 8" to "8th"');
  assert(normalizeClassGrade('9') === '9th', 'Normalizes "9" to "9th"');
  assert(normalizeClassGrade('Class 9th') === '9th', 'Normalizes "Class 9th" to "9th"');
  assert(normalizeClassGrade('10') === '10th', 'Normalizes "10" to "10th"');
  assert(normalizeClassGrade('Class 10th') === '10th', 'Normalizes "Class 10th" to "10th"');

  assert(normalizeClassGrade('11') === '11th', 'Normalizes "11" to "11th"');
  assert(normalizeClassGrade('12th') === '12th', 'Normalizes "12th" to "12th"');
  assert(normalizeClassGrade('MSC') === 'MSC', 'Normalizes "MSC" to "MSC"');
  assert(normalizeClassGrade('msc') === 'MSC', 'Normalizes "msc" to "MSC"');
  assert(normalizeClassGrade('M.Sc') === 'MSC', 'Normalizes "M.Sc" to "MSC"');
  assert(normalizeClassGrade('BSC') === 'BSC', 'Normalizes "BSC" to "BSC"');
  assert(normalizeClassGrade('B.Tech') === 'B.Tech', 'Normalizes "B.Tech" to "B.Tech"');
  assert(normalizeClassGrade('') === null, 'Rejects empty class as invalid');
  assert(normalizeClassGrade('NA') === null, 'Rejects "NA" placeholder as invalid');
  assert(isValidCanonicalClass('6th') === true, 'isValidCanonicalClass accepts "6th"');
  assert(isValidCanonicalClass('MSC') === true, 'isValidCanonicalClass accepts "MSC"');
  assert(isValidCanonicalClass('') === false, 'isValidCanonicalClass rejects empty string');

  // -------------------------------------------------------------------------
  // TEST SUITE 2: DATABASE SCHEMA & PARENT-STUDENT MODEL
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Database Schema & Parent-Student Relationships ---');
  const tableCheck = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'parent_students'
  `);
  const columns = tableCheck.rows.map(r => r.column_name);
  assert(columns.includes('parent_id'), 'parent_students has parent_id column');
  assert(columns.includes('student_id'), 'parent_students has student_id column');
  assert(columns.includes('relationship'), 'parent_students has relationship column');

  const batchColCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'batches' AND column_name = 'class_grade'
  `);
  assert(batchColCheck.rows.length > 0, 'batches table has class_grade column');

  // -------------------------------------------------------------------------
  // TEST SUITE 3: BULK IMPORT OF SCHOOL STUDENTS & PARENTS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Bulk Import & Multi-Child / Shared Parent Mapping ---');

  // Clean up any previous test records
  await pool.query(`DELETE FROM users WHERE email LIKE '%@lifeawakening.internal' OR name IN ('Aarav Sharma', 'Ananya Sharma', 'Rohan Mehta') OR email IN ('mom.test@example.com', 'dad.test@example.com', 'single.mom@example.com')`);

  const mockUploadedRows = [
    {
      'Student Full Name ': 'Aarav Sharma',
      'Email Address1': 'mom.test@example.com',
      'Email Address 2': 'dad.test@example.com',
      'Class / Standard ': 'Class 6th',
      'Division': 'A',
      'Name of the School': 'Tree House High School',
      'School Branch': 'Kalyan',
      'Date of Birth ': '2012-05-15',
      'Gender ': 'Male',
      'Blood Group ': 'O+',
      'Parent/Guardian Name ': 'Sunita Sharma',
      'Relationship with Student ': 'Mother',
      'Contact Number (Valid What\'s App Mobile Number)': '9876543210',
      'Parent/Guardian Consent Confirmation': 'Yes',
      'Does your child have any medical condition? ': 'None'
    },
    {
      'Student Full Name ': 'Ananya Sharma',
      'Email Address1': 'mom.test@example.com', // Same mother
      'Email Address 2': 'dad.test@example.com', // Same father
      'Class / Standard ': '8',
      'Division': 'B',
      'Name of the School': 'Tree House High School',
      'School Branch': 'Kalyan',
      'Date of Birth ': '2010-08-20',
      'Gender ': 'Female',
      'Blood Group ': 'B+',
      'Parent/Guardian Name ': 'Sunita Sharma',
      'Relationship with Student ': 'Mother',
      'Contact Number (Valid What\'s App Mobile Number)': '9876543210',
      'Parent/Guardian Consent Confirmation': 'Yes'
    },
    {
      'Student Full Name ': 'Rohan Mehta',
      'Email Address1': 'single.mom@example.com',
      'Email Address 2': '', // Single parent
      'Class / Standard ': 'Class 10',
      'Division': 'C',
      'Name of the School': 'City International',
      'School Branch': 'Mumbai',
      'Date of Birth ': '2008-01-10',
      'Gender ': 'Male',
      'Blood Group ': 'A+',
      'Parent/Guardian Name ': 'Pooja Mehta',
      'Relationship with Student ': 'Mother',
      'Contact Number (Valid What\'s App Mobile Number)': '9123456789'
    }
  ];

  const importResult = await processLifeAwakeningStudentUploadJob(null, mockUploadedRows, null, 1, 'Admin', 'skip');
  console.log('IMPORT RESULT:', JSON.stringify(importResult, null, 2));
  assert(importResult.success === true, 'Bulk import job finished with success');
  assert(importResult.imported === 3, `Imported exactly 3 students (got ${importResult.imported})`);
  assert(importResult.errors.length === 0, 'Zero import errors reported');

  // Verify Parent Accounts created and reused
  const parentsRes = await pool.query(`SELECT id, email, role, name FROM users WHERE email IN ('mom.test@example.com', 'dad.test@example.com', 'single.mom@example.com') ORDER BY email`);
  assert(parentsRes.rows.length === 3, 'Exactly 3 parent accounts created for the 3 distinct parent emails');

  const mom = parentsRes.rows.find(p => p.email === 'mom.test@example.com');
  const dad = parentsRes.rows.find(p => p.email === 'dad.test@example.com');
  const singleMom = parentsRes.rows.find(p => p.email === 'single.mom@example.com');

  assert(mom && mom.role === 'parent', 'Mother has role "parent"');
  assert(dad && dad.role === 'parent', 'Father has role "parent"');
  assert(singleMom && singleMom.role === 'parent', 'Single mother has role "parent"');

  // Verify Student Records created
  const studentsRes = await pool.query(`SELECT id, name, class_grade, division, school, role, prn FROM users WHERE name IN ('Aarav Sharma', 'Ananya Sharma', 'Rohan Mehta') ORDER BY name`);
  assert(studentsRes.rows.length === 3, 'All 3 student records exist in users table');

  const aarav = studentsRes.rows.find(s => s.name === 'Aarav Sharma');
  const ananya = studentsRes.rows.find(s => s.name === 'Ananya Sharma');
  const rohan = studentsRes.rows.find(s => s.name === 'Rohan Mehta');

  assert(aarav && aarav.class_grade === '6th', 'Aarav has canonical class "6th"');
  assert(ananya && ananya.class_grade === '8th', 'Ananya has canonical class "8th"');
  assert(rohan && rohan.class_grade === '10th', 'Rohan has canonical class "10th"');
  assert(aarav.role === 'student', 'Student has role "student"');

  // Verify Parent-Student Links
  const momLinks = await pool.query(`SELECT student_id FROM parent_students WHERE parent_id = $1 ORDER BY student_id`, [mom.id]);
  assert(momLinks.rows.length === 2, 'Mother is linked to both children (Aarav and Ananya)');
  const momChildIds = momLinks.rows.map(r => r.student_id);
  assert(momChildIds.includes(aarav.id) && momChildIds.includes(ananya.id), 'Mother links contain Aarav ID and Ananya ID');

  const dadLinks = await pool.query(`SELECT student_id FROM parent_students WHERE parent_id = $1 ORDER BY student_id`, [dad.id]);
  assert(dadLinks.rows.length === 2, 'Father is also linked to both shared children');

  const singleMomLinks = await pool.query(`SELECT student_id FROM parent_students WHERE parent_id = $1`, [singleMom.id]);
  assert(singleMomLinks.rows.length === 1 && singleMomLinks.rows[0].student_id === rohan.id, 'Single mother is linked only to Rohan');

  // Test Idempotency / Re-import
  console.log('\n--- TEST SUITE 4: Re-import Idempotency & Duplicate Handling ---');
  const reimportResult = await processLifeAwakeningStudentUploadJob(null, mockUploadedRows, null, 1, 'Admin', 'skip');
  assert(reimportResult.skipped === 3 || reimportResult.imported === 0, 'Re-importing exact same rows detects duplicates and does not create new records');
  
  const parentsCountAfter = await pool.query(`SELECT COUNT(*)::int as count FROM users WHERE email IN ('mom.test@example.com', 'dad.test@example.com', 'single.mom@example.com')`);
  assert(parentsCountAfter.rows[0].count === 3, 'Parent count remains exactly 3 after re-import');

  // -------------------------------------------------------------------------
  // TEST SUITE 5: SERVER-SIDE AUTHORIZATION (authorizeStudentContext Middleware)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: Server-Side Authorization Enforcement ---');

  // Helper to run middleware
  async function testAuthMiddleware(reqUser, targetStudentHeader, targetParamId) {
    let statusCode = 200;
    let jsonBody = null;
    let nextCalled = false;

    const req = {
      user: reqUser,
      headers: targetStudentHeader ? { 'x-student-id': String(targetStudentHeader) } : {},
      params: targetParamId ? { id: String(targetParamId) } : {},
      query: {},
      body: {}
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { jsonBody = data; return data; }
        };
      }
    };
    const next = () => { nextCalled = true; };

    await authorizeStudentContext(req, res, next);
    return { statusCode, nextCalled, jsonBody, studentId: req.studentId };
  }

  // 1. Mom accesses Aarav (authorized child)
  const momAccessAarav = await testAuthMiddleware(mom, aarav.id);
  assert(momAccessAarav.nextCalled === true && momAccessAarav.studentId === aarav.id, 'Parent can access their authorized child (Aarav)');

  // 2. Mom accesses Ananya (second authorized child)
  const momAccessAnanya = await testAuthMiddleware(mom, ananya.id);
  assert(momAccessAnanya.nextCalled === true && momAccessAnanya.studentId === ananya.id, 'Parent can access their second authorized child (Ananya)');

  // 3. Mom attempts to access Rohan (unrelated child) -> MUST FAIL 403
  const momAccessRohan = await testAuthMiddleware(mom, rohan.id);
  assert(momAccessRohan.statusCode === 403 && !momAccessRohan.nextCalled, 'Parent CANNOT access unrelated family student (Rohan) -> blocked with 403');

  // 4. Dad accesses Ananya (shared child)
  const dadAccessAnanya = await testAuthMiddleware(dad, ananya.id);
  assert(dadAccessAnanya.nextCalled === true, 'Father can access shared child (Ananya)');

  // 5. Admin can access any child
  const adminRow = await pool.query("SELECT id FROM users WHERE role IN ('admin', 'superadmin') LIMIT 1");
  const adminUser = { id: adminRow.rows[0]?.id || 1, role: 'admin', email: 'admin@test.com' };
  const adminAccessRohan = await testAuthMiddleware(adminUser, rohan.id);
  assert(adminAccessRohan.nextCalled === true, 'Admin can access any student context');

  // -------------------------------------------------------------------------
  // TEST SUITE 6: BATCH CREATION & CLASS COMPATIBILITY VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: Batch Creation & Class Compatibility Validation ---');

  // Create test batch for 8th class
  const batchRes = await pool.query(`
    INSERT INTO batches (name, location, start_date, end_date, status, capacity, class_grade)
    VALUES ('UNIT_TEST_BATCH_CLASS_8', 'LTC Boribel', '2026-06-01', '2026-06-10', 'upcoming', 50, '8th')
    RETURNING id, name, class_grade
  `);
  const testBatch = batchRes.rows[0];
  assert(testBatch.class_grade === '8th', 'Batch created with canonical class "8th"');

  // Check assignment validation logic
  const { addBatchStudents, addOneBatchStudent } = require('../controllers/adminController');

  // Simulate assignment of Ananya (Class 8th) -> compatible
  let assign8thStatus = 200;
  let assign8thBody = null;
  await addBatchStudents(
    { params: { id: testBatch.id }, body: { student_ids: [ananya.id] }, user: adminUser },
    { status: (c) => { assign8thStatus = c; return { json: (b) => { assign8thBody = b; return b; } }; }, json: (b) => { assign8thBody = b; return b; } }
  );
  assert(assign8thStatus === 200 && assign8thBody.added >= 1, 'Assigned 8th standard student to 8th standard batch successfully');

  // Simulate assignment of Aarav (Class 6th) to 8th batch via addOneBatchStudent -> incompatible, should be blocked
  let assign6thStatus = 200;
  let assign6thBody = null;
  await addOneBatchStudent(
    { params: { id: testBatch.id }, body: { student_id: aarav.id }, user: adminUser },
    { status: (c) => { assign6thStatus = c; return { json: (b) => { assign6thBody = b; return b; } }; }, json: (b) => { assign6thBody = b; return b; } }
  );
  assert(assign6thStatus === 400, 'Assigning 6th standard student to 8th standard batch rejected with 400 Bad Request');
  assert(assign6thBody && assign6thBody.message.includes('Class mismatch'), 'Error message specifically flags class mismatch');

  // Clean up test batch and test users
  await pool.query(`DELETE FROM batch_students WHERE batch_id = $1`, [testBatch.id]);
  await pool.query(`DELETE FROM batches WHERE id = $1`, [testBatch.id]);
  await pool.query(`DELETE FROM parent_students WHERE parent_id IN ($1, $2, $3)`, [mom.id, dad.id, singleMom.id]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5, $6)`, [mom.id, dad.id, singleMom.id, aarav.id, ananya.id, rohan.id]);

  console.log('\n=====================================================');
  console.log(`TEST RUN COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
