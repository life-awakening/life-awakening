require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const API_BASE = 'http://localhost:5001/api';
const JWT_SECRET = process.env.JWT_SECRET || 'local_ri_development_jwt_secret_key';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const status = res.status;
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  return { status, ok: res.ok, data };
}

async function runTests() {
  console.log('===============================================================');
  console.log('--- STARTING RI BATCH & STUDENT ENHANCEMENT TESTS ---');
  console.log('===============================================================');

  // Find or create admin user for valid token
  const adminUserRes = await pool.query("SELECT id, email, role FROM users WHERE role ILIKE 'superadmin' OR role ILIKE 'ri_admin' LIMIT 1");
  const adminId = adminUserRes.rows[0]?.id || 1;
  const adminEmail = adminUserRes.rows[0]?.email || 'admin@test.com';

  const adminToken = createToken({
    id: adminId,
    role: 'ri_admin',
    email: adminEmail
  });

  let testRiDirectBatchId = null;
  let testLtcSyncBatchId = null;
  let ltcBatchId = null;
  let createdBatchCode = null;
  let riDirectStudentId = null;
  const timestamp = Date.now();
  const originalStudentEmail = `ri_test_${timestamp}@example.com`;
  const updatedStudentEmail = `ri_updated_${timestamp}@example.com`;

  try {
    // ---------------------------------------------------------
    // TEST 1: Automatic RI Batch Code Generation (RI_DIRECT)
    // ---------------------------------------------------------
    console.log('\n[Test 1] Creating RI Direct Batch and verifying auto-generated batch code...');
    const createRes = await request('POST', '/ri/batches', {
      name: `Test Immersion Cohort ${timestamp}`,
      start_date: '2026-09-01',
      end_date: '2026-09-15',
      description: 'Automated test cohort'
    }, adminToken);

    if (!createRes.ok) {
      throw new Error(`Failed to create batch: ${JSON.stringify(createRes.data)}`);
    }

    testRiDirectBatchId = createRes.data.batch.id;
    createdBatchCode = createRes.data.batch.batch_code;
    console.log(`✓ Batch created with ID: ${testRiDirectBatchId}, Auto Batch Code: "${createdBatchCode}"`);

    // Verify format: RI-[0-9]{2}-[0-9]{4}
    const codeFormatRegex = /^RI-\d{2}-\d{4}$/;
    if (!codeFormatRegex.test(createdBatchCode)) {
      throw new Error(`Batch code "${createdBatchCode}" does not match required format RI-XX-MMYY`);
    }
    console.log('✓ Batch code strictly matches format RI-[2-digit sequential RI batch number]-[MMYY]');

    // Concurrency test: create 3 batches simultaneously
    console.log('Testing concurrent RI Direct batch creation for sequence uniqueness...');
    const concurrentPromises = [1, 2, 3].map(i => request('POST', '/ri/batches', {
      name: `Concurrent Cohort ${i} ${timestamp}`,
      start_date: '2026-09-01',
      end_date: '2026-09-15'
    }, adminToken));

    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentCodes = concurrentResults.map(r => r.data.batch.batch_code);
    console.log('Concurrent codes generated:', concurrentCodes);
    const uniqueCodes = new Set(concurrentCodes);
    if (uniqueCodes.size !== concurrentCodes.length) {
      throw new Error('Concurrent batch code collision detected!');
    }
    console.log('✓ Concurrent batch creations safely produced unique sequential codes.');
    // Cleanup concurrent batches
    for (const r of concurrentResults) {
      await pool.query('DELETE FROM ri_batches WHERE id = $1', [r.data.batch.id]);
    }

    // ---------------------------------------------------------
    // TEST 2: Bulk Upload Students to RI Direct -> Sequential RI IDs
    // ---------------------------------------------------------
    console.log('\n[Test 2] Bulk uploading students to RI Direct batch and verifying sequential RI IDs...');
    const uploadRes = await request('POST', `/ri/batches/${testRiDirectBatchId}/students/bulk-upload`, {
      students: [
        {
          name: 'Direct RI Student 1',
          email: originalStudentEmail,
          prn: `PRN_DIR_${timestamp}_1`,
          phone: '9876543210',
          gender: 'Female',
          school: 'School of Engineering',
          department: 'Computer Science',
          division: 'A',
          panel: 'Panel 1'
        },
        {
          name: 'Direct RI Student 2',
          email: `ri_test_2_${timestamp}@example.com`,
          prn: `PRN_DIR_${timestamp}_2`,
          phone: '9876543211',
          gender: 'Male',
          school: 'School of Engineering',
          department: 'Computer Science',
          division: 'A',
          panel: 'Panel 1'
        }
      ]
    }, adminToken);

    if (!uploadRes.ok) {
      throw new Error(`Bulk upload failed: ${JSON.stringify(uploadRes.data)}`);
    }
    console.log('Bulk upload response:', uploadRes.data);

    // Inspect ri_batch_students in DB
    const studentRows = await pool.query(
      `SELECT rbs.id, rbs.student_id, rbs.ri_id, u.email, u.prn 
       FROM ri_batch_students rbs 
       JOIN users u ON u.id = rbs.student_id 
       WHERE rbs.ri_batch_id = $1 
       ORDER BY rbs.ri_id ASC`,
      [testRiDirectBatchId]
    );

    console.log('Inserted RI direct students:', studentRows.rows);
    if (studentRows.rows.length < 2) {
      throw new Error('Expected at least 2 students in RI Direct batch');
    }

    const firstStudent = studentRows.rows[0];
    const secondStudent = studentRows.rows[1];
    riDirectStudentId = firstStudent.student_id;

    const expectedId1 = `${createdBatchCode}-01`;
    const expectedId2 = `${createdBatchCode}-02`;

    if (firstStudent.ri_id !== expectedId1 || secondStudent.ri_id !== expectedId2) {
      throw new Error(`RI student IDs mismatch. Expected ${expectedId1} & ${expectedId2}, got ${firstStudent.ri_id} & ${secondStudent.ri_id}`);
    }
    console.log(`✓ RI-only student IDs generated sequentially: ${firstStudent.ri_id}, ${secondStudent.ri_id}`);

    // Verify LTC isolation: student must not exist in LTC batch_students
    const ltcCheck = await pool.query(
      `SELECT * FROM batch_students WHERE student_id = $1`,
      [riDirectStudentId]
    );
    if (ltcCheck.rows.length > 0) {
      throw new Error('RI Direct student was unexpectedly enrolled into LTC batch_students table!');
    }
    console.log('✓ RI Direct student is NOT enrolled in LTC batch_students (clean isolation).');

    // ---------------------------------------------------------
    // TEST 3: LTC_SYNC Batch & Student Protection
    // ---------------------------------------------------------
    console.log('\n[Test 3] Setting up LTC_SYNC batch and testing security restrictions...');
    // Create an LTC batch
    const ltcBatchRes = await pool.query(
      `INSERT INTO batches (name, start_date, end_date, year, status)
       VALUES ($1, '2026-09-01', '2026-09-15', 2026, 'ACTIVE')
       RETURNING id`,
      [`LTC Source Batch ${timestamp}`]
    );
    ltcBatchId = ltcBatchRes.rows[0].id;

    // Create linked RI batch with source_program = 'LTC_SYNC'
    const syncBatchRes = await pool.query(
      `INSERT INTO ri_batches (name, batch_code, start_date, end_date, status, source_program, source_batch_id)
       VALUES ($1, 'LTC-SYNC-01', '2026-09-01', '2026-09-15', 'ACTIVE', 'LTC_SYNC', $2)
       RETURNING id, batch_code, source_program`,
      [`RI Synced Cohort ${timestamp}`, ltcBatchId]
    );
    testLtcSyncBatchId = syncBatchRes.rows[0].id;
    console.log(`✓ Created LTC_SYNC batch ID: ${testLtcSyncBatchId} linked to LTC batch: ${ltcBatchId}`);

    // Try to update LTC_SYNC batch via API -> MUST BE REJECTED 403
    console.log('Attempting PUT /api/ri/batches/:id on LTC_SYNC batch...');
    const putSyncRes = await request('PUT', `/ri/batches/${testLtcSyncBatchId}`, {
      name: 'Hacked Name Attempt'
    }, adminToken);
    if (putSyncRes.status === 403) {
      console.log(`✓ Backend correctly rejected PUT on LTC_SYNC batch with 403 Forbidden: "${putSyncRes.data.message}"`);
    } else {
      throw new Error(`Security vulnerability: Updating LTC_SYNC batch returned status ${putSyncRes.status}, expected 403 Forbidden!`);
    }

    // Try to delete LTC_SYNC batch via API -> MUST BE REJECTED 403
    console.log('Attempting DELETE /api/ri/batches/:id on LTC_SYNC batch...');
    const delSyncRes = await request('DELETE', `/ri/batches/${testLtcSyncBatchId}`, null, adminToken);
    if (delSyncRes.status === 403) {
      console.log(`✓ Backend correctly rejected DELETE on LTC_SYNC batch with 403 Forbidden: "${delSyncRes.data.message}"`);
    } else {
      throw new Error(`Security vulnerability: Deleting LTC_SYNC batch returned status ${delSyncRes.status}, expected 403 Forbidden!`);
    }

    // Verify linked LTC batch still exists and is completely intact
    const verifyLtcBatch = await pool.query('SELECT * FROM batches WHERE id = $1', [ltcBatchId]);
    if (verifyLtcBatch.rows.length === 0) {
      throw new Error('Linked LTC batch was deleted or corrupted!');
    }
    console.log('✓ Linked LTC batch and data are completely protected and intact.');

    // Upload a student to LTC_SYNC batch -> ri_id MUST remain NULL
    console.log('Testing bulk upload to LTC_SYNC batch to verify ri_id is NULL...');
    const uploadSyncStudentRes = await request('POST', `/ri/batches/${testLtcSyncBatchId}/students/bulk-upload`, {
      students: [
        {
          name: 'LTC Synced Student',
          email: `ltc_sync_${timestamp}@example.com`,
          prn: `PRN_SYNC_${timestamp}`,
          phone: '9998887776',
          gender: 'Male'
        }
      ]
    }, adminToken);

    if (!uploadSyncStudentRes.ok) {
      throw new Error(`Upload to LTC_SYNC batch failed: ${JSON.stringify(uploadSyncStudentRes.data)}`);
    }

    const ltcSyncStudent = await pool.query(
      `SELECT rbs.ri_id FROM ri_batch_students rbs WHERE rbs.ri_batch_id = $1`,
      [testLtcSyncBatchId]
    );
    if (ltcSyncStudent.rows[0].ri_id !== null) {
      throw new Error(`LTC_SYNC student should have ri_id = NULL, but got "${ltcSyncStudent.rows[0].ri_id}"`);
    }
    console.log('✓ LTC_SYNC student properly received ri_id = NULL (keeps LTC identity/PRN).');

    // ---------------------------------------------------------
    // TEST 4: Student Details Edit & Immediate Login Update
    // ---------------------------------------------------------
    console.log('\n[Test 4] Editing RI student details and verifying immediate login credential update...');
    // Set a known password for the test student
    const testPassword = 'Password@123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, riDirectStudentId]);

    // Test login with original email
    const loginOriginal = await request('POST', '/login', {
      email: originalStudentEmail,
      password: testPassword
    });
    if (!loginOriginal.data?.token) {
      throw new Error(`Initial login with original email failed: ${JSON.stringify(loginOriginal.data)}`);
    }
    console.log(`✓ Login with original email (${originalStudentEmail}) succeeded.`);

    // Edit student via PUT /api/ri/students/:id
    console.log(`Updating student email to ${updatedStudentEmail} and changing name & department...`);
    const updateStudentRes = await request('PUT', `/ri/students/${riDirectStudentId}`, {
      name: 'Updated Direct Student Name',
      email: updatedStudentEmail,
      phone: '9123456780',
      gender: 'Female',
      school: 'School of Business',
      department: 'Finance',
      division: 'B',
      batch_id: testRiDirectBatchId
    }, adminToken);

    if (!updateStudentRes.ok || !updateStudentRes.data.success) {
      throw new Error(`Update student API failed: ${JSON.stringify(updateStudentRes.data)}`);
    }
    console.log('✓ Update student API call succeeded:', updateStudentRes.data.student);

    // Verify DB record
    const updatedUserRow = await pool.query('SELECT name, email, department FROM users WHERE id = $1', [riDirectStudentId]);
    if (updatedUserRow.rows[0].email !== updatedStudentEmail.toLowerCase() || updatedUserRow.rows[0].department !== 'Finance') {
      throw new Error(`DB user record not updated properly: ${JSON.stringify(updatedUserRow.rows[0])}`);
    }
    console.log('✓ Database users record immediately updated with new email and fields.');

    // Attempt login with OLD email -> MUST FAIL
    console.log('Verifying login with OLD email now fails...');
    const loginOld = await request('POST', '/login', {
      email: originalStudentEmail,
      password: testPassword
    });
    if (loginOld.status === 400 || loginOld.status === 401) {
      console.log('✓ Login with OLD email failed as expected (invalid credentials).');
    } else {
      throw new Error(`Security failure: Login with OLD email succeeded with status ${loginOld.status}!`);
    }

    // Attempt login with NEW email -> MUST SUCCEED
    console.log('Verifying login with NEW email succeeds...');
    const loginNew = await request('POST', '/login', {
      email: updatedStudentEmail,
      password: testPassword
    });
    if (!loginNew.data?.token) {
      throw new Error(`Login with new email failed: ${JSON.stringify(loginNew.data)}`);
    }
    console.log(`✓ Login with NEW email (${updatedStudentEmail}) succeeded immediately!`);

    // ---------------------------------------------------------
    // TEST 5: Update and Delete RI Direct Batch
    // ---------------------------------------------------------
    console.log('\n[Test 5] Testing update and delete for RI_DIRECT batch...');
    const updateBatchRes = await request('PUT', `/ri/batches/${testRiDirectBatchId}`, {
      name: 'Renamed RI Direct Cohort',
      start_date: '2026-09-02',
      end_date: '2026-09-18',
      status: 'ACTIVE',
      description: 'Updated description'
    }, adminToken);
    if (!updateBatchRes.ok || updateBatchRes.data.batch.name !== 'Renamed RI Direct Cohort') {
      throw new Error(`Updating RI Direct batch failed: ${JSON.stringify(updateBatchRes.data)}`);
    }
    console.log('✓ RI Direct batch updated successfully.');

    // Delete RI Direct batch
    const deleteBatchRes = await request('DELETE', `/ri/batches/${testRiDirectBatchId}`, null, adminToken);
    if (!deleteBatchRes.ok || !deleteBatchRes.data.success) {
      throw new Error(`Deleting RI Direct batch failed: ${JSON.stringify(deleteBatchRes.data)}`);
    }
    console.log('✓ RI Direct batch deleted successfully.');

    // Verify batch and student enrollments are removed
    const verifyDeleted = await pool.query('SELECT * FROM ri_batches WHERE id = $1', [testRiDirectBatchId]);
    if (verifyDeleted.rows.length > 0) {
      throw new Error('Batch still present in database after delete');
    }
    console.log('✓ RI Direct batch cleanly removed from database.');

    console.log('\n===============================================================');
    console.log('🎉 ALL 5 TEST SUITES PASSED SUCCESSFULLY! EVERYTHING IS VERIFIED! 🎉');
    console.log('===============================================================');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    // Cleanup any lingering test records
    if (testLtcSyncBatchId) {
      await pool.query('DELETE FROM ri_batch_students WHERE ri_batch_id = $1', [testLtcSyncBatchId]);
      await pool.query('DELETE FROM ri_batches WHERE id = $1', [testLtcSyncBatchId]);
    }
    if (ltcBatchId) {
      await pool.query('DELETE FROM batches WHERE id = $1', [ltcBatchId]);
    }
    await pool.end();
  }
}

runTests();
