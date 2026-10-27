const assert = require('assert');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/db');
const {
  validateVillageFacultyUpload,
  importVillageFacultyUpload
} = require('../controllers/riController');

async function runVillageFacultyEmailFixTests() {
  console.log('========================================================================');
  console.log('TEST SUITE: RI Village & Faculty Bulk Upload - Optional Class Teacher Email');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(msg) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  }

  function fail(msg, err) {
    console.error(`  ❌ FAIL: ${msg}`, err ? (err.message || err) : '');
    failed++;
  }

  // 1. Locate active batch
  const batchRes = await pool.query(`SELECT id, name FROM ri_batches ORDER BY id DESC LIMIT 1`);
  if (batchRes.rowCount === 0) {
    throw new Error('No RI batch found');
  }
  const batchId = batchRes.rows[0].id;
  console.log(`Using target RI batch ID ${batchId} ("${batchRes.rows[0].name}")`);

  // Helper for mock validate
  const mockValidate = (buffer, filename = 'test.xlsx') => {
    return new Promise((resolve) => {
      const req = {
        params: { id: batchId },
        file: { originalname: filename, buffer },
        user: { id: 1, email: 'admin@ltc.edu', role: 'superadmin' }
      };
      const res = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          resolve({ status: this.statusCode || 200, data: payload });
        }
      };
      validateVillageFacultyUpload(req, res).catch(err => {
        resolve({ status: 500, error: err });
      });
    });
  };

  // Helper for mock import with payload rows
  const mockImportWithRows = (rows) => {
    return new Promise((resolve) => {
      const req = {
        params: { id: batchId },
        body: { rows },
        user: { id: 1, email: 'admin@ltc.edu', role: 'superadmin' }
      };
      const res = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          resolve({ status: this.statusCode || 200, data: payload });
        }
      };
      importVillageFacultyUpload(req, res).catch(err => {
        resolve({ status: 500, error: err });
      });
    });
  };

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Inspect & Validate Village_Details_Only.xlsx (Class Teacher email is optional)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Validation of Village_Details_Only.xlsx (Optional Class Teacher Email) ---');
    const villageOnlyPath = '/Users/ahsanimamkhan/Desktop/Village_Details_Only.xlsx';
    if (!fs.existsSync(villageOnlyPath)) {
      throw new Error(`File ${villageOnlyPath} not found`);
    }
    const villageOnlyBuffer = fs.readFileSync(villageOnlyPath);

    const valResult1 = await mockValidate(villageOnlyBuffer, 'Village_Details_Only.xlsx');
    console.log(`Validation status code: ${valResult1.status} (Expected 200)`);
    console.log(`Validation message: ${valResult1.data?.message}`);
    console.log(`Panels count in preview: ${valResult1.data?.preview?.panels?.length}`);
    console.log(`Missing faculty emails: ${valResult1.data?.preview?.missing_faculty_emails?.length || 0}`);

    assert.strictEqual(valResult1.status, 200, 'Village_Details_Only.xlsx must validate with 200 OK');
    assert.strictEqual(valResult1.data.success, true, 'Validation success must be true');
    assert.strictEqual(valResult1.data.preview.has_errors, false, 'preview.has_errors must be false');
    assert.strictEqual(valResult1.data.preview.missing_faculty_emails.length, 0, 'No missing emails flagged for Class Teachers');

    // Verify Class Teacher names are parsed and present in preview
    const samplePanel = valResult1.data.preview.panels.find(p => p.panel_name === 'SYBBA-BA-A');
    assert.ok(samplePanel, 'Panel SYBBA-BA-A found in preview');
    assert.strictEqual(samplePanel.class_teacher_name, 'Dr. Piyush Shaha', 'Class teacher name correctly parsed into preview');

    pass('Village_Details_Only.xlsx validates successfully with Class Teacher names parsed and missing email treated as optional.');

    // ------------------------------------------------------------------------
    // TEST 2: Accompany Faculty Missing Email is Strictly Blocked
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Block Validation and Import for Accompany Faculty Missing Email ---');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Panel', 'Village Name', 'Class Teachers (Advance taken Faculty Name)', 'Accompany Faculty 1', 'Accompany Faculty 1 Email'],
      ['SYBBA-BA-A', 'Khalad,Tal.Purandar', 'Dr. Piyush Shaha', 'Prof Missing Accompany Email', '']
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const missingAccompanyBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const valResult2 = await mockValidate(missingAccompanyBuf, 'test_missing_accompany.xlsx');
    console.log(`Validation status code: ${valResult2.status} (Expected 400)`);
    console.log(`Validation error: ${valResult2.data?.message}`);

    assert.strictEqual(valResult2.status, 400, 'Validation must reject when accompany faculty lacks email');
    assert.strictEqual(valResult2.data.success, false, 'success must be false');
    assert.ok(valResult2.data.missing_faculty_emails.length > 0, 'missing_faculty_emails includes accompany faculty');
    assert.strictEqual(valResult2.data.missing_faculty_emails[0].role, 'Accompany Faculty 1');

    // Also verify import blocked
    const impResult2 = await mockImportWithRows([
      {
        row_index: 2,
        panel: 'SYBBA-BA-A',
        village_name: 'Khalad,Tal.Purandar',
        class_teacher_name: 'Dr. Piyush Shaha',
        accompany_faculty: [{ role: 'Accompany Faculty 1', name: 'Prof Missing Accompany Email', email: '' }]
      }
    ]);
    assert.strictEqual(impResult2.status, 400, 'Import must block when accompany faculty lacks email');
    pass('Accompany faculty with missing email is strictly blocked in both validation and import.');

    // ------------------------------------------------------------------------
    // TEST 3: Unmatched Faculty with Valid Email is Preserved (Auto Account Creation)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Unmatched Faculty with Valid Email Preserved without Prior User Account ---');
    const timestamp = Date.now();
    const testUnmatchedEmail = `unmatched.faculty.${timestamp}@mitwpu.edu.in`;
    const testFacultyName = `Prof. Test Unmatched ${timestamp}`;

    await pool.query(`DELETE FROM users WHERE LOWER(email) = LOWER($1)`, [testUnmatchedEmail]);

    const validUnmatchedRows = [
      {
        row_index: 2,
        panel: 'SYBBA-BA-A',
        village_name: 'Khalad,Tal.Purandar',
        department: 'BBA',
        accompany_faculty: [
          {
            role: 'Accompany Faculty 1',
            name: testFacultyName,
            email: testUnmatchedEmail
          }
        ]
      }
    ];

    const impResult3 = await mockImportWithRows(validUnmatchedRows);
    assert.strictEqual(impResult3.status, 200, 'Import should succeed for unmatched faculty with valid email');
    assert.strictEqual(impResult3.data.success, true, 'Import success must be true');

    const facRecord3 = await pool.query(`
      SELECT rbf.id, rbf.ri_batch_id, rbf.ri_panel_id, rbf.name, rbf.email, rbf.role, rbf.status
      FROM ri_batch_faculty rbf
      WHERE rbf.ri_batch_id = $1 AND LOWER(rbf.email) = LOWER($2)
    `, [batchId, testUnmatchedEmail]);

    assert.strictEqual(facRecord3.rowCount, 1, 'Faculty record successfully inserted in ri_batch_faculty');
    assert.strictEqual(facRecord3.rows[0].email, testUnmatchedEmail, 'Non-null email preserved in ri_batch_faculty');
    pass('Unmatched faculty with valid email is successfully preserved in ri_batch_faculty without database error.');

    await pool.query(`DELETE FROM ri_batch_faculty WHERE LOWER(email) = LOWER($1)`, [testUnmatchedEmail]);
    await pool.query(`DELETE FROM users WHERE LOWER(email) = LOWER($1)`, [testUnmatchedEmail]);

    // ------------------------------------------------------------------------
    // TEST 4: Matched Faculty via Existing User Account (Obtain Email from Account)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Matched Faculty via Existing User Account ---');
    const testMatchedEmail = `matched.faculty.${timestamp}@mitwpu.edu.in`;
    const testMatchedName = `Dr. Established Scholar ${timestamp}`;

    const userRes4 = await pool.query(`
      INSERT INTO users (name, email, password, role, department, status, created_at)
      VALUES ($1, $2, 'hashed_test_pwd', 'ri_faculty', 'Management', 'active', NOW())
      RETURNING id
    `, [testMatchedName, testMatchedEmail]);
    const establishedUserId = userRes4.rows[0].id;

    const matchedRows = [
      {
        row_index: 2,
        panel: 'SYBBA-BA-A',
        village_name: 'Khalad,Tal.Purandar',
        class_teacher_name: testMatchedName,
        class_teacher_email: '', // no explicit email in cell, resolves via user account!
        accompany_faculty: []
      }
    ];

    const impResult4 = await mockImportWithRows(matchedRows);
    assert.strictEqual(impResult4.status, 200, 'Import should succeed when faculty matches existing user account');

    const facRecord4 = await pool.query(`
      SELECT rbf.id, rbf.faculty_id, rbf.name, rbf.email, rbf.role
      FROM ri_batch_faculty rbf
      WHERE rbf.ri_batch_id = $1 AND rbf.faculty_id = $2
    `, [batchId, establishedUserId]);

    assert.strictEqual(facRecord4.rowCount, 1, 'Matched faculty assigned to panel in ri_batch_faculty');
    assert.strictEqual(facRecord4.rows[0].email, testMatchedEmail, 'Inherited valid non-null email from matched user');
    pass('Matched faculty without explicit cell email inherits existing user account email.');

    await pool.query(`DELETE FROM ri_batch_faculty WHERE faculty_id = $1`, [establishedUserId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [establishedUserId]);

    // ------------------------------------------------------------------------
    // TEST 5: Class Teacher with Explicit Email in Excel
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Class Teacher with Explicit Email in Excel ---');
    const ctEmailDirect = `ct.direct.${timestamp}@mitwpu.edu.in`;
    const ctNameDirect = `Dr. Dedicated Class Teacher ${timestamp}`;

    const ctRows = [
      {
        row_index: 2,
        panel: 'SYBBA-BA-A',
        village_name: 'Khalad,Tal.Purandar',
        class_teacher_name: ctNameDirect,
        class_teacher_email: ctEmailDirect,
        accompany_faculty: []
      }
    ];

    const impResult5 = await mockImportWithRows(ctRows);
    assert.strictEqual(impResult5.status, 200, 'Import succeeds when Class Teacher has class_teacher_email');

    const facRecord5 = await pool.query(`
      SELECT id, name, email, role FROM ri_batch_faculty
      WHERE ri_batch_id = $1 AND LOWER(email) = LOWER($2)
    `, [batchId, ctEmailDirect]);
    assert.strictEqual(facRecord5.rowCount, 1, 'Class teacher record created with non-null email in ri_batch_faculty');
    assert.strictEqual(facRecord5.rows[0].role, 'Class Teacher');
    pass('Class Teacher with explicit email creates ri_batch_faculty entry.');

    await pool.query(`DELETE FROM ri_batch_faculty WHERE LOWER(email) = LOWER($1)`, [ctEmailDirect]);
    await pool.query(`DELETE FROM users WHERE LOWER(email) = LOWER($1)`, [ctEmailDirect]);

    // ------------------------------------------------------------------------
    // TEST 6: Class Teacher with NO Email and NO User Match (Safe Panel Name Recording)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Class Teacher with NO Email and NO User Match ---');
    const ctNameNoEmail = `Dr. No Email Teacher ${timestamp}`;

    const noEmailRows = [
      {
        row_index: 2,
        panel: 'SYBBA-BA-A',
        village_name: 'Khalad,Tal.Purandar',
        class_teacher_name: ctNameNoEmail,
        class_teacher_email: '',
        accompany_faculty: []
      }
    ];

    const impResult6 = await mockImportWithRows(noEmailRows);
    assert.strictEqual(impResult6.status, 200, 'Import must succeed without throwing not-null email error');

    // Verify panel updated with class_teacher_name
    const panelCheck6 = await pool.query(
      `SELECT class_teacher_name FROM ri_panels WHERE ri_batch_id = $1 AND name = 'SYBBA-BA-A'`,
      [batchId]
    );
    assert.strictEqual(panelCheck6.rows[0].class_teacher_name, ctNameNoEmail, 'Panel class_teacher_name recorded');

    // Verify no NULL email or fake email was inserted into ri_batch_faculty
    const facCheck6 = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM ri_batch_faculty WHERE ri_batch_id = $1 AND name = $2`,
      [batchId, ctNameNoEmail]
    );
    assert.strictEqual(facCheck6.rows[0].cnt, 0, 'No NULL or placeholder record inserted into ri_batch_faculty');
    pass('Class Teacher with no email safely updates panel class_teacher_name without violating ri_batch_faculty constraints.');

  } catch (err) {
    fail('Exception during test execution', err);
  }

  console.log('\n========================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} CHECKS PASSED CLEANLY WITH ZERO ERRORS!`);
  } else {
    console.log(`❌ TEST RUN FINISHED WITH ${failed} FAILURES (${passed} passed).`);
  }
  console.log('========================================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runVillageFacultyEmailFixTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
