require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const pool = require('../config/db');
const adminController = require('../controllers/adminController');
const superadminController = require('../controllers/superadminController');
const riController = require('../controllers/riController');

function createMockReqRes(params = {}, query = {}, body = {}, user = { id: 1, role: 'admin' }) {
  let statusCode = 200;
  let responseData = null;

  const req = {
    params,
    query,
    body,
    user
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    setHeader() {
      return this;
    }
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: LTC & RI Student Isolation Verification');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(msg) {
    console.log(`  PASS: ${msg}`);
    passed++;
  }

  function fail(msg, err) {
    console.error(`  FAIL: ${msg}`);
    if (err) console.error(err);
    failed++;
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: LTC Admin getUsers excludes RI_DIRECT-only students
    // -------------------------------------------------------------
    console.log('[TEST 1] LTC Admin - getUsers Endpoint Verification');
    const mock1 = createMockReqRes();
    await adminController.getUsers(mock1.req, mock1.res);
    assert.strictEqual(mock1.getStatus(), 200, 'getUsers should return HTTP 200');

    const users = mock1.getData().users;
    assert.ok(Array.isArray(users), 'users array must be returned');

    const studentUsers = users.filter(u => u.role === 'student');
    console.log(`  LTC Student count returned by getUsers: ${studentUsers.length}`);

    assert.strictEqual(studentUsers.length, 364, `Expected exactly 364 LTC students, got ${studentUsers.length}`);
    pass('getUsers returned exactly 364 LTC students (isolated from 383 RI_DIRECT students)');

    // Verify none of the 383 RI_DIRECT student IDs appear in users
    const riDirectIdsRes = await pool.query(
      "SELECT student_id FROM ri_batch_students WHERE source_program = 'RI_DIRECT'"
    );
    const riDirectIdSet = new Set(riDirectIdsRes.rows.map(r => r.student_id));

    const leakedUsers = users.filter(u => riDirectIdSet.has(u.id));
    assert.strictEqual(leakedUsers.length, 0, `Expected 0 leaked RI_DIRECT students, found ${leakedUsers.length}`);
    pass('Verified 0 RI_DIRECT students present in LTC Admin users list');

    // -------------------------------------------------------------
    // TEST 2: LTC Admin getStudents excludes RI_DIRECT-only students
    // -------------------------------------------------------------
    console.log('\n[TEST 2] LTC Admin - getStudents Endpoint Verification');
    const mock2 = createMockReqRes({}, { limit: 1000, page: 1 });
    await adminController.getStudents(mock2.req, mock2.res);
    assert.strictEqual(mock2.getStatus(), 200, 'getStudents should return HTTP 200');

    const studentData = mock2.getData();
    assert.strictEqual(studentData.pagination.total, 364, `Pagination total expected 364, got ${studentData.pagination.total}`);
    assert.strictEqual(studentData.students.length, 364, `Returned students expected 364, got ${studentData.students.length}`);
    pass('getStudents returned total of 364 students');

    const leakedFromGetStudents = studentData.students.filter(s => riDirectIdSet.has(s.id));
    assert.strictEqual(leakedFromGetStudents.length, 0, `Expected 0 leaked students in getStudents`);
    pass('Verified 0 RI_DIRECT students in getStudents response');

    // -------------------------------------------------------------
    // TEST 3: SuperAdmin Export students isolation
    // -------------------------------------------------------------
    console.log('\n[TEST 3] SuperAdmin - Global Students Export Isolation');
    const mock3 = createMockReqRes({ type: 'students' }, {}, {}, { id: 1, role: 'superadmin' });
    await superadminController.generateReport(mock3.req, mock3.res);
    assert.strictEqual(mock3.getStatus(), 200, 'generateReport should return HTTP 200');

    const reportData = mock3.getData();
    const exportStudentCount = reportData.count;
    console.log(`  Exported student count: ${exportStudentCount}`);
    assert.strictEqual(exportStudentCount, 364, `Expected 364 exported LTC students, got ${exportStudentCount}`);
    pass('Superadmin student report strictly contains 364 LTC students without RI_DIRECT leakage');

    // -------------------------------------------------------------
    // TEST 4: Rural Immersion (RI) Module Preserves All Students
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Rural Immersion - Cohort Integrity Verification');
    // RI All Students should see all 747 students
    const mockRiAll = createMockReqRes({}, { all: 'true' });
    await riController.getAllRiStudents(mockRiAll.req, mockRiAll.res);
    const riAllData = mockRiAll.getData();
    assert.strictEqual(riAllData.total, 747, `RI All Students expected 747 total, got ${riAllData.total}`);
    pass('RI module correctly manages all 747 students across cohorts');

    // RI_DIRECT filter must return 383 students
    const mockRiDirect = createMockReqRes({}, { source: 'RI_DIRECT', all: 'true' });
    await riController.getAllRiStudents(mockRiDirect.req, mockRiDirect.res);
    const riDirectData = mockRiDirect.getData();
    assert.strictEqual(riDirectData.total, 383, `RI_DIRECT filter expected 383 students, got ${riDirectData.total}`);
    pass('RI module retains all 383 RI_DIRECT students exclusively');

    // LTC_SYNC filter must return 364 students
    const mockRiLtc = createMockReqRes({}, { source: 'LTC_SYNC', all: 'true' });
    await riController.getAllRiStudents(mockRiLtc.req, mockRiLtc.res);
    const riLtcData = mockRiLtc.getData();
    assert.strictEqual(riLtcData.total, 364, `LTC_SYNC filter expected 364 students, got ${riLtcData.total}`);
    pass('RI module retains all 364 LTC_SYNC students with official LTC linkages');

    // -------------------------------------------------------------
    // TEST 5: Dynamic Creation in RI_DIRECT Remains Isolated
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Dynamic Creation in RI_DIRECT Isolation Test');
    const riDirectBatchRes = await pool.query(
      "SELECT id FROM ri_batches WHERE source_program = 'RI_DIRECT' LIMIT 1"
    );
    const riBatchId = riDirectBatchRes.rows[0].id;

    const testStudentPayload = {
      name: 'Isolation Test Student',
      email: 'isolation_test_student@mitwpu.edu.in',
      prn: 'ISO-9999-001',
      gender: 'Male',
      semester: 'Semester 4',
      department: 'Computer Science',
      division: 'A',
      school: 'School of Engineering'
    };

    const mockCreate = createMockReqRes({ id: riBatchId }, {}, testStudentPayload, { id: 1, role: 'admin' });
    await riController.createRiStudent(mockCreate.req, mockCreate.res);
    assert.strictEqual(mockCreate.getStatus(), 201, 'Student creation in RI_DIRECT should succeed');
    const createdStudentId = mockCreate.getData().student.id;
    pass(`Created test student in RI_DIRECT batch (User ID: ${createdStudentId})`);

    // Verify student is immediately visible in RI
    const mockCheckRi = createMockReqRes({}, { search: 'ISO-9999-001' });
    await riController.getAllRiStudents(mockCheckRi.req, mockCheckRi.res);
    assert.strictEqual(mockCheckRi.getData().total, 1, 'Student must appear in RI');
    pass('Test student is visible in RI Admin directory');

    // Verify student NEVER appears in LTC Admin getUsers
    const mockCheckLtcUsers = createMockReqRes();
    await adminController.getUsers(mockCheckLtcUsers.req, mockCheckLtcUsers.res);
    const ltcUsersAfter = mockCheckLtcUsers.getData().users;
    const leakedNewStudentInUsers = ltcUsersAfter.find(u => u.id === createdStudentId);
    assert.strictEqual(leakedNewStudentInUsers, undefined, 'Test student must NOT appear in LTC getUsers');
    pass('Test student is completely isolated and absent from LTC Admin getUsers');

    // Verify student NEVER appears in LTC Admin getStudents
    const mockCheckLtcStudents = createMockReqRes({}, { search: 'ISO-9999-001' });
    await adminController.getStudents(mockCheckLtcStudents.req, mockCheckLtcStudents.res);
    assert.strictEqual(mockCheckLtcStudents.getData().pagination.total, 0, 'Test student must NOT appear in LTC getStudents');
    pass('Test student is absent from LTC Admin getStudents search');

    // Clean up test student
    await pool.query('DELETE FROM ri_batch_students WHERE student_id = $1', [createdStudentId]);
    await pool.query('DELETE FROM users WHERE id = $1', [createdStudentId]);
    pass('Test student cleaned up successfully');

  } catch (err) {
    fail('Exception during test execution', err);
  }

  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`ALL TESTS PASSED! (${passed} checks passed, 0 failed)`);
  } else {
    console.log(`TESTS FAILED (${passed} passed, ${failed} failed)`);
  }
  console.log('================================================================\n');

  process.exit(failed === 0 ? 0 : 1);
}

runTests();
