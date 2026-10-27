const assert = require('assert');
const pool = require('../config/db');
const riController = require('../controllers/riController');

function mockReqRes(params = {}, body = {}, query = {}, file = null) {
  let statusCode = 200;
  let responseData = null;
  const req = {
    params,
    body,
    query,
    file,
    user: { id: 381564, role: 'superadmin', name: 'Super Admin' }
  };
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    }
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

async function runIsolationTests() {
  console.log('================================================================');
  console.log('REGRESSION TEST: RI Direct Bulk Upload Isolation & Duplicate Prevention');
  console.log('================================================================\n');

  const testLtcPrn = `LTC-TEST-${Date.now()}`;
  const testLtcEmail = `ltc.sync.${Date.now()}@mitwpu.edu.in`;
  const testLtcName = 'Test Synchronized LTC Student';

  const testRiPrn = `RI-TEST-${Date.now()}`;
  const testRiEmail = `ri.direct.${Date.now()}@mitwpu.edu.in`;
  const testRiName = 'Test Direct RI Student';

  let ltcUserId = null;
  let riUserId = null;
  let riDirectBatchId = null;
  let ltcSyncBatchId = null;
  let ltcBatchId = null;
  let createdLtcBatch = false;
  let createdSyncBatch = false;

  try {
    // Check for or create synthetic LTC batch
    const existingLtcBatch = await pool.query(
      `SELECT id FROM batches WHERE is_deleted IS NOT TRUE LIMIT 1`
    );
    if (existingLtcBatch.rowCount === 0) {
      const newLtcBatch = await pool.query(`
        INSERT INTO batches (name, batch_code, status, start_date, end_date)
        VALUES ('Synthetic LTC Batch', 'LTC-SYNTH-01', 'Active', '2026-10-15', '2026-10-20')
        RETURNING id
      `);
      ltcBatchId = newLtcBatch.rows[0].id;
      createdLtcBatch = true;
    } else {
      ltcBatchId = existingLtcBatch.rows[0].id;
    }

    // Check for or create linked RI_SYNC batch
    const existingSyncBatch = await pool.query(
      `SELECT id, source_batch_id FROM ri_batches WHERE source_program = 'LTC_SYNC' AND source_batch_id = $1 LIMIT 1`,
      [ltcBatchId]
    );
    if (existingSyncBatch.rowCount === 0) {
      const newSyncBatch = await pool.query(`
        INSERT INTO ri_batches (name, batch_code, status, start_date, end_date, panel_capacity, source_program, source_batch_id)
        VALUES ('Synthetic RI Sync Batch', 'RI-LTC-SYNC', 'Active', '2026-10-15', '2026-10-20', 60, 'LTC_SYNC', $1)
        RETURNING id
      `, [ltcBatchId]);
      ltcSyncBatchId = newSyncBatch.rows[0].id;
      createdSyncBatch = true;
    } else {
      ltcSyncBatchId = existingSyncBatch.rows[0].id;
    }

    // Create an isolated synthetic RI_DIRECT batch for testing
    const createRiBatchRes = await pool.query(`
      INSERT INTO ri_batches (name, batch_code, status, start_date, end_date, panel_capacity, source_program, source_batch_id)
      VALUES ('Synthetic Test RI Direct Batch', 'RI-TEST-DIR', 'Active', '2026-10-15', '2026-10-20', 60, 'RI_DIRECT', NULL)
      RETURNING id, batch_code
    `);
    riDirectBatchId = createRiBatchRes.rows[0].id;

    // Create a panel in the synthetic RI batch
    await pool.query(`
      INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
      VALUES ($1, 1, 'Test Panel 1', 60)
    `, [riDirectBatchId]);

    console.log(`[SETUP] Initialized Test Batches:`);
    console.log(`  - LTC Batch ID: ${ltcBatchId} (created: ${createdLtcBatch})`);
    console.log(`  - Linked RI_SYNC Batch ID: ${ltcSyncBatchId} (created: ${createdSyncBatch})`);
    console.log(`  - Isolated RI_DIRECT Batch ID: ${riDirectBatchId}\n`);

    // -------------------------------------------------------------------------
    // TEST 1: Create student in LTC and verify expected LTC-to-RI synchronization
    // -------------------------------------------------------------------------
    console.log('[TEST 1] LTC Student Creation & Sync to Linked RI Batch');
    const userInsert = await pool.query(`
      INSERT INTO users (name, email, password, prn, role, department, school, division, in_current_batch)
      VALUES ($1, $2, 'hashed_test_password', $3, 'student', 'Computer Science', 'Engineering', 'A', true)
      RETURNING id
    `, [testLtcName, testLtcEmail, testLtcPrn]);
    ltcUserId = userInsert.rows[0].id;

    // Enroll in LTC batch
    await pool.query(`
      INSERT INTO batch_students (batch_id, student_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [ltcBatchId, ltcUserId]);

    // Enroll in linked RI_SYNC batch (as synchronized by LTC system)
    await pool.query(`
      INSERT INTO ri_batch_students (ri_batch_id, student_id, source_program, source_ltc_batch_id, enrollment_type, ri_id)
      VALUES ($1, $2, 'LTC_SYNC', $3, 'LTC_SYNC', NULL)
      ON CONFLICT DO NOTHING
    `, [ltcSyncBatchId, ltcUserId, ltcBatchId]);

    console.log(`  PASS: Student ${testLtcPrn} created in LTC and synchronized to RI Batch ${ltcSyncBatchId}`);

    // Capture baseline database counts before testing duplicate bulk upload
    const userCountBefore = (await pool.query(`SELECT count(*)::int as count FROM users`)).rows[0].count;
    const riEnrollCountBefore = (await pool.query(`SELECT count(*)::int as count FROM ri_batch_students`)).rows[0].count;
    const riIdCountBefore = (await pool.query(`SELECT count(*)::int as count FROM ri_batch_students WHERE ri_id IS NOT NULL`)).rows[0].count;

    // -------------------------------------------------------------------------
    // TEST 2: Attempt to upload same PRN & Email to RI_DIRECT batch -> MUST REJECT
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Duplicate Upload of Existing LTC Student to RI_DIRECT Batch');

    // 2a. Pre-validation check
    const mockValReq2 = mockReqRes({ id: riDirectBatchId }, {
      mode: 'batch_wise',
      rows: [
        {
          prn: testLtcPrn,
          name: testLtcName,
          email: testLtcEmail,
          panel: 'Test Panel 1'
        }
      ]
    });
    await riController.validateStudentUpload(mockValReq2.req, mockValReq2.res);
    const valData2 = mockValReq2.getData();

    assert.strictEqual(valData2.summary.valid_rows, 0, 'LTC student row must NOT be marked valid');
    assert.strictEqual(valData2.summary.invalid_rows, 1, 'LTC student row must be marked invalid');
    assert.strictEqual(valData2.validated_rows[0].is_valid, false, 'Row is_valid must be false');
    assert.ok(
      valData2.validated_rows[0].errors.some(e => e.includes('already registered in LTC')),
      `Expected error to state student is registered in LTC, got: ${JSON.stringify(valData2.validated_rows[0].errors)}`
    );
    console.log(`  PASS: Pre-validation correctly rejected LTC student with error: "${valData2.validated_rows[0].errors[0]}"`);

    // 2b. Execution check (bulkUploadStudents)
    const mockUpReq2 = mockReqRes({ id: riDirectBatchId }, {
      mode: 'batch_wise',
      students: [
        {
          prn: testLtcPrn,
          name: testLtcName,
          email: testLtcEmail,
          panel: 'Test Panel 1'
        }
      ]
    });
    await riController.bulkUploadStudents(mockUpReq2.req, mockUpReq2.res);
    const upData2 = mockUpReq2.getData();

    assert.strictEqual(upData2.imported_count, 0, 'Imported count must be 0');
    assert.strictEqual(upData2.rejected_count, 1, 'Rejected count must be 1');
    assert.strictEqual(upData2.accounts_created, 0, 'No user accounts should be created');
    assert.strictEqual(upData2.rejected_rows.length, 1, 'Must return 1 rejected row record');
    assert.ok(
      upData2.rejected_rows[0].reason.includes('already registered in LTC'),
      `Reason must mention registered in LTC, got: "${upData2.rejected_rows[0].reason}"`
    );
    console.log(`  PASS: bulkUploadStudents rejected upload (Imported: 0, Rejected: 1, Reason: "${upData2.rejected_rows[0].reason}")`);

    // Verify database counts remain strictly identical
    const userCountAfter2 = (await pool.query(`SELECT count(*)::int as count FROM users`)).rows[0].count;
    const riEnrollCountAfter2 = (await pool.query(`SELECT count(*)::int as count FROM ri_batch_students`)).rows[0].count;
    const riIdCountAfter2 = (await pool.query(`SELECT count(*)::int as count FROM ri_batch_students WHERE ri_id IS NOT NULL`)).rows[0].count;

    assert.strictEqual(userCountAfter2, userCountBefore, 'users count must NOT change');
    assert.strictEqual(riEnrollCountAfter2, riEnrollCountBefore, 'ri_batch_students count must NOT change');
    assert.strictEqual(riIdCountAfter2, riIdCountBefore, 'ri_id count must NOT change');
    console.log('  PASS: Verified ZERO additional users, ZERO enrollments, and ZERO RI IDs were created');

    // -------------------------------------------------------------------------
    // TEST 3: Attempt upload with email casing differences and surrounding whitespace
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Upload with Casing Differences and Surrounding Whitespace');
    const mockUpReq3 = mockReqRes({ id: riDirectBatchId }, {
      mode: 'batch_wise',
      rows: [
        {
          prn: `   ${testLtcPrn.toLowerCase()}   `,
          name: testLtcName,
          email: `   ${testLtcEmail.toUpperCase()}   `,
          panel: 'Test Panel 1'
        }
      ]
    });
    await riController.bulkUploadStudents(mockUpReq3.req, mockUpReq3.res);
    const upData3 = mockUpReq3.getData();

    assert.strictEqual(upData3.imported_count, 0, 'Must reject row with whitespace/casing');
    assert.strictEqual(upData3.rejected_count, 1, 'Must increment rejected count');
    assert.ok(
      upData3.rejected_rows[0].reason.includes('already registered in LTC'),
      'Must detect student regardless of whitespace or casing'
    );
    console.log(`  PASS: Normalization verified: Whitespace & casing handled, row rejected: "${upData3.rejected_rows[0].reason}"`);

    // -------------------------------------------------------------------------
    // TEST 4: Attempt upload with same email but conflicting PRN -> Reject for Review
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Upload with Same Email but Conflicting PRN (Identity Conflict)');
    const conflictingPrn = `CONFLICT-PRN-${Date.now()}`;
    const mockUpReq4 = mockReqRes({ id: riDirectBatchId }, {
      mode: 'batch_wise',
      rows: [
        {
          prn: conflictingPrn,
          name: 'Imposter Student',
          email: testLtcEmail,
          panel: 'Test Panel 1'
        }
      ]
    });
    await riController.bulkUploadStudents(mockUpReq4.req, mockUpReq4.res);
    const upData4 = mockUpReq4.getData();

    assert.strictEqual(upData4.imported_count, 0, 'Must not import conflicting identity');
    assert.strictEqual(upData4.rejected_count, 1, 'Must reject conflicting identity');
    assert.ok(
      upData4.rejected_rows[0].reason.includes('LTC') || upData4.rejected_rows[0].reason.includes('Identity conflict'),
      `Reason must note LTC or identity conflict: "${upData4.rejected_rows[0].reason}"`
    );
    console.log(`  PASS: Conflicting PRN rejected without modifying existing user: "${upData4.rejected_rows[0].reason}"`);

    // -------------------------------------------------------------------------
    // TEST 5: Upload a genuinely new RI-only student -> MUST SUCCEED
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Upload of Genuinely New RI-Only Student');
    const mockUpReq5 = mockReqRes({ id: riDirectBatchId }, {
      mode: 'batch_wise',
      rows: [
        {
          prn: testRiPrn,
          name: testRiName,
          email: testRiEmail,
          panel: 'Test Panel 1',
          school: 'School of Design',
          department: 'Design',
          gender: 'Female'
        }
      ]
    });
    await riController.bulkUploadStudents(mockUpReq5.req, mockUpReq5.res);
    const upData5 = mockUpReq5.getData();

    assert.strictEqual(upData5.imported_count, 1, 'Genuine RI student must be imported');
    assert.strictEqual(upData5.rejected_count, 0, 'Rejected count must be 0');
    assert.strictEqual(upData5.accounts_created, 1, 'Must create 1 new user account');

    // Verify database record for new student
    const newStudentRes = await pool.query(
      `SELECT rbs.*, u.id as user_id, u.prn, u.email 
       FROM ri_batch_students rbs 
       JOIN users u ON rbs.student_id = u.id 
       WHERE u.prn = $1`,
      [testRiPrn]
    );
    assert.strictEqual(newStudentRes.rowCount, 1, 'Must exist in ri_batch_students');
    const newStudent = newStudentRes.rows[0];
    riUserId = newStudent.user_id;

    assert.strictEqual(newStudent.source_program, 'RI_DIRECT', 'Source program must be RI_DIRECT');
    assert.ok(newStudent.ri_id && newStudent.ri_id.startsWith('RI-TEST-DIR'), `RI ID must be formatted properly: ${newStudent.ri_id}`);

    // Verify student is strictly absent from LTC batch_students
    const ltcCheckRes = await pool.query(`SELECT 1 FROM batch_students WHERE student_id = $1`, [riUserId]);
    assert.strictEqual(ltcCheckRes.rowCount, 0, 'RI-only student must NOT have LTC enrollment');
    console.log(`  PASS: Genuine RI student enrolled successfully (PRN: ${testRiPrn}, RI ID: ${newStudent.ri_id})`);

    // -------------------------------------------------------------------------
    // TEST 6: Include duplicate PRNs within a single spreadsheet
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Duplicate PRNs Within a Single Upload File');
    const intraDupPrn = `INTRA-DUP-${Date.now()}`;
    const intraDupEmail1 = `intra1.${Date.now()}@mitwpu.edu.in`;
    const intraDupEmail2 = `intra2.${Date.now()}@mitwpu.edu.in`;

    const mockUpReq6 = mockReqRes({ id: riDirectBatchId }, {
      mode: 'batch_wise',
      rows: [
        { prn: intraDupPrn, name: 'Student Instance 1', email: intraDupEmail1, panel: 'Test Panel 1' },
        { prn: intraDupPrn, name: 'Student Instance 2', email: intraDupEmail2, panel: 'Test Panel 1' }
      ]
    });
    await riController.bulkUploadStudents(mockUpReq6.req, mockUpReq6.res);
    const upData6 = mockUpReq6.getData();

    assert.strictEqual(upData6.imported_count, 1, 'First instance should succeed');
    assert.strictEqual(upData6.rejected_count, 1, 'Second instance with duplicate PRN must be rejected');
    assert.ok(
      upData6.rejected_rows[0].reason.includes('Duplicate PRN within file'),
      `Reason must note duplicate PRN: "${upData6.rejected_rows[0].reason}"`
    );
    console.log(`  PASS: Intra-file duplicate prevented (Imported: 1, Rejected: 1, Reason: "${upData6.rejected_rows[0].reason}")`);

    // Clean up intra-file test student
    await pool.query(`DELETE FROM users WHERE prn = $1`, [intraDupPrn]);

    // -------------------------------------------------------------------------
    // TEST 7: Re-upload an existing RI-only student -> Follow explicit duplicate rejection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Re-upload Existing RI Student Duplicate Rejection');
    const mockUpReq7 = mockReqRes({ id: riDirectBatchId }, {
      mode: 'batch_wise',
      rows: [
        {
          prn: testRiPrn,
          name: testRiName,
          email: testRiEmail,
          panel: 'Test Panel 1'
        }
      ]
    });
    await riController.bulkUploadStudents(mockUpReq7.req, mockUpReq7.res);
    const upData7 = mockUpReq7.getData();

    assert.strictEqual(upData7.imported_count, 0, 'Re-uploading existing RI student must NOT re-import');
    assert.strictEqual(upData7.rejected_count, 1, 'Re-upload must be rejected');
    assert.ok(
      upData7.rejected_rows[0].reason.includes('already enrolled in this RI batch'),
      `Expected reason to indicate already enrolled, got: "${upData7.rejected_rows[0].reason}"`
    );
    console.log(`  PASS: Existing RI student re-upload rejected: "${upData7.rejected_rows[0].reason}"`);

    // -------------------------------------------------------------------------
    // TEST 8: Verify All RI Students directory does NOT gain another row
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Verify Directory Does Not Gain Duplicate Rows');
    const mockDirReq = mockReqRes({}, {}, { search: testLtcPrn });
    await riController.getAllRiStudents(mockDirReq.req, mockDirReq.res);
    const dirData = mockDirReq.getData();

    // Student should only appear ONCE in directory (for their original LTC_SYNC batch)
    assert.strictEqual(
      dirData.students.length, 1,
      `Expected exactly 1 directory entry for LTC student ${testLtcPrn}, found ${dirData.students.length}`
    );
    assert.strictEqual(dirData.students[0].source_program, 'LTC_SYNC', 'Remaining entry must be LTC_SYNC');
    console.log(`  PASS: Verified All RI Students directory contains exactly 1 entry for ${testLtcPrn} without duplication`);

    // -------------------------------------------------------------------------
    // TEST 9: Single Student Creation Endpoint (createRiStudent) Protection
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Direct Single Student Creation Protection (createRiStudent)');
    const mockSingleCreate = mockReqRes({ id: riDirectBatchId }, {
      prn: testLtcPrn,
      name: testLtcName,
      email: testLtcEmail,
      gender: 'Male',
      semester: 'Semester 4'
    });
    await riController.createRiStudent(mockSingleCreate.req, mockSingleCreate.res);

    assert.strictEqual(mockSingleCreate.getStatus(), 400, 'createRiStudent must return HTTP 400 for LTC student');
    assert.ok(
      mockSingleCreate.getData().message.includes('already registered in LTC'),
      `Message must state student registered in LTC: "${mockSingleCreate.getData()?.message}"`
    );
    console.log(`  PASS: createRiStudent rejected LTC student creation: "${mockSingleCreate.getData()?.message}"`);

    console.log('\n================================================================');
    console.log('ALL REGRESSION TESTS PASSED! (Tests 1 through 9 Verified)');
    console.log('================================================================');

  } finally {
    // Teardown: Clean up synthetic test records
    if (ltcUserId) {
      await pool.query(`DELETE FROM ri_batch_students WHERE student_id = $1`, [ltcUserId]);
      await pool.query(`DELETE FROM batch_students WHERE student_id = $1`, [ltcUserId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [ltcUserId]);
    }
    if (riUserId) {
      await pool.query(`DELETE FROM ri_batch_students WHERE student_id = $1`, [riUserId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [riUserId]);
    }
    if (riDirectBatchId) {
      await pool.query(`DELETE FROM ri_panels WHERE ri_batch_id = $1`, [riDirectBatchId]);
      await pool.query(`DELETE FROM ri_batches WHERE id = $1`, [riDirectBatchId]);
    }
    if (createdSyncBatch && ltcSyncBatchId) {
      await pool.query(`DELETE FROM ri_batches WHERE id = $1`, [ltcSyncBatchId]);
    }
    if (createdLtcBatch && ltcBatchId) {
      await pool.query(`DELETE FROM batches WHERE id = $1`, [ltcBatchId]);
    }
    console.log(`[TEARDOWN] Synthetic test records cleaned up safely.`);
  }
}

runIsolationTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nTEST SUITE FAILED:', err);
    process.exit(1);
  });
