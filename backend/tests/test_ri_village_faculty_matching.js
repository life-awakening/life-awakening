const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/db');
const { validateVillageFacultyUpload } = require('../controllers/riController');

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: RI Village & Faculty Upload - Faculty Matching Logic');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(msg) {
    console.log(`  PASS: ${msg}`);
    passed++;
  }

  function fail(msg, err) {
    console.error(`  FAIL: ${msg}`, err ? err.message : '');
    failed++;
  }

  const excelPath = path.resolve(__dirname, '../../frontend/RI-Batch-07 Village-faculty Data.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error('File not found:', excelPath);
    process.exit(1);
  }
  const fileBuffer = fs.readFileSync(excelPath);

  // Find target RI batch (e.g. BATCH 1)
  const batchRes = await pool.query(`SELECT id, name FROM ri_batches WHERE id = 163 OR source_program = 'LTC_SYNC' LIMIT 1`);
  if (batchRes.rowCount === 0) {
    console.error('Target batch not found');
    process.exit(1);
  }
  const batchId = batchRes.rows[0].id;

  // Helper to mock express req/res
  const mockValidate = async () => {
    return new Promise((resolve) => {
      const req = {
        params: { id: batchId },
        file: {
          originalname: 'RI-Batch-07 Village-faculty Data.xlsx',
          buffer: fileBuffer
        }
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

  try {
    // -------------------------------------------------------------
    // TEST 1: Baseline Validation
    // -------------------------------------------------------------
    console.log('[TEST 1] Baseline Validation - Faculty Detection');
    const res1 = await mockValidate();
    if (res1.status !== 200) {
      console.error('Validation returned error:', res1.data);
    }
    assert.strictEqual(res1.status, 200, 'Status should be 200');
    assert.ok(res1.data.success, 'Success should be true');
    assert.strictEqual(res1.data.preview.total_panels, 5, 'Should identify 5 panels');
    assert.strictEqual(res1.data.preview.total_villages, 5, 'Should identify 5 villages');
    assert.strictEqual(res1.data.preview.total_faculty_mappings, 18, 'Total faculty mappings should be 18');
    const baselineMatched = res1.data.preview.matched_faculty_count;
    const baselineUnmatched = res1.data.preview.unmatched_faculty_count;
    assert.ok(baselineMatched >= 3, `Baseline matched count should be at least 3, got ${baselineMatched}`);
    assert.strictEqual(baselineMatched + baselineUnmatched, 18, 'Matched + unmatched should equal 18 total mappings');
    assert.ok(Array.isArray(res1.data.preview.unmatched_faculty), 'Unmatched faculty array exists');
    pass('Baseline validation correctly parsed 5 panels, 5 villages, and detected 18 faculty mappings');
    pass(`Correctly matches ${baselineMatched} existing faculty mappings and ${baselineUnmatched} unmatched`);

    // -------------------------------------------------------------
    // TEST 2: Matching with Additional Faculty Accounts
    // Insert Dr. Shanu Gupta and Mr. Ravi Nikam
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Name Normalization & Dynamic Matching with Database Accounts');
    
    // Create test faculty users with varied salutations/structures
    const shanuRes = await pool.query(`
      INSERT INTO users (name, email, password, role, department, status)
      VALUES ('Dr. Shanu Gupta', 'test_shanu_gupta@mitwpu.edu.in', 'hashed_pwd_placeholder', 'faculty', 'Media & Communication', 'active')
      RETURNING id
    `);
    const shanuId = shanuRes.rows[0].id;

    const nikamRes = await pool.query(`
      INSERT INTO users (name, email, password, role, department, status)
      VALUES ('Mr. Ravi Nikam', 'test_ravi_nikam@mitwpu.edu.in', 'hashed_pwd_placeholder', 'faculty', 'Media & Communication', 'active')
      RETURNING id
    `);
    const nikamId = nikamRes.rows[0].id;

    // Run validation again
    const res2 = await mockValidate();
    assert.strictEqual(res2.status, 200, 'Status should be 200');

    // Dr. Shanu Gupta is in Row 1 twice (Class Teacher + Accompany Faculty 1)
    // Mr. Ravi Nikam is in Row 1 once (Accompany Faculty 2)
    // Added 3 newly matched mappings!
    const matchedCount = res2.data.preview.matched_faculty_count;
    const unmatchedCount = res2.data.preview.unmatched_faculty_count;

    assert.strictEqual(matchedCount, baselineMatched + 3, `Expected ${baselineMatched + 3} matched mappings, got ${matchedCount}`);
    assert.strictEqual(unmatchedCount, baselineUnmatched - 3, `Expected ${baselineUnmatched - 3} unmatched mappings, got ${unmatchedCount}`);
    pass(`Accurately matched +3 faculty mappings for newly added faculty accounts (Dr. Shanu Gupta x2, Mr. Ravi Nikam x1)`);
    pass(`Accurately marked remaining ${unmatchedCount} genuinely unmatched faculty`);

    // Verify row 1 preview has matched flags and user IDs
    const row1 = res2.data.preview.panels.find(p => p.panel_name === 'ECE-A');
    assert.ok(row1, 'Row 1 (ECE-A) found');
    const row1Faculty = row1.faculty;
    const matchedShanu = row1Faculty.filter(f => f.name.includes('Shanu') && f.matched);
    const matchedNikam = row1Faculty.filter(f => f.name.includes('Ravi') && f.matched);
    const unmatchedGangwane = row1Faculty.filter(f => f.name.includes('Gangwane') && !f.matched);

    assert.strictEqual(matchedShanu.length, 2, 'Dr. Shanu Gupta matched in both roles in Row 1');
    assert.strictEqual(matchedNikam.length, 1, 'Mr. Ravi Nikam matched in Row 1');
    assert.strictEqual(unmatchedGangwane.length, 1, 'Ms. Sushila Gangwane correctly remains unmatched');
    pass('Row 1 preview panel faculty accurately displays MATCHED for Dr. Shanu Gupta and Mr. Ravi Nikam');
    pass('Ms. Sushila Gangwane correctly remains UNMATCHED');

    // -------------------------------------------------------------
    // TEST 3: Negative Matching Verification (No False Positives)
    // Verify student "Archit Nikam" does not false-match "Mr. Ravi Nikam"
    // -------------------------------------------------------------
    console.log('\n[TEST 3] False Positive Prevention (Different First Names with Shared Surname)');
    // Delete test Ravi Nikam, leaving only student Mr Archit Satish Nikam in the DB
    await pool.query(`DELETE FROM users WHERE id = $1`, [nikamId]);
    
    const res3 = await mockValidate();
    const row1After = res3.data.preview.panels.find(p => p.panel_name === 'ECE-A');
    const nikamAfter = row1After.faculty.find(f => f.name.includes('Ravi'));
    assert.strictEqual(nikamAfter.matched, false, 'Mr. Ravi Nikam must NOT match student Archit Nikam');
    pass('False positive prevented: Mr. Ravi Nikam correctly rejected against student Archit Nikam');

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Database Cleanup & Integrity');
    await pool.query(`DELETE FROM users WHERE id = $1`, [shanuId]);
    pass('Test accounts cleaned up completely without database schema or data alterations');

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
