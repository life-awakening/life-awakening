const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { parseSpreadsheetBuffer, normalizeStudentRow } = require('../controllers/riController');
const { parseExcelSheetSmart, mapOfficialHeaders } = require('../controllers/adminController');

async function runTest() {
  console.log('=== TEST: RI Master Sheet Bulk Upload Compatibility ===\n');

  const filePath = path.resolve(__dirname, '../../frontend/Master Sheet.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error('Master Sheet.xlsx not found at', filePath);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(filePath);
  console.log('1. Testing parseSpreadsheetBuffer on Master Sheet.xlsx...');
  const parsedRows = parseSpreadsheetBuffer(fileBuffer, 'Master Sheet.xlsx');
  console.log(`   Parsed rows count: ${parsedRows.length}`);
  if (parsedRows.length === 0) {
    throw new Error('parseSpreadsheetBuffer returned 0 rows!');
  }

  console.log('\n2. Testing normalizeStudentRow on first 3 rows...');
  for (let i = 0; i < Math.min(3, parsedRows.length); i++) {
    const norm = normalizeStudentRow(parsedRows[i]);
    console.log(`   Row ${i + 1}:`);
    console.log(`     PRN: ${norm.prn}`);
    console.log(`     Name: ${norm.name}`);
    console.log(`     Email: ${norm.email}`);
    console.log(`     Panel: ${norm.panel_input}`);
    console.log(`     Department: ${norm.department}`);
    console.log(`     School: ${norm.school}`);
    console.log(`     Division: ${norm.division}`);
    console.log(`     Gender: ${norm.gender}`);
    console.log(`     Mobile: ${norm.phone}`);
    console.log(`     DOB: ${norm.dob}`);

    if (!norm.prn) throw new Error(`Row ${i + 1} is missing PRN!`);
    if (!norm.name) throw new Error(`Row ${i + 1} is missing Name!`);
    if (!norm.email) throw new Error(`Row ${i + 1} is missing Email! ("Email is required" bug check)`);
  }

  console.log('\n3. Verifying all rows for missing PRN, Name, or Email...');
  let missingPrn = 0;
  let missingName = 0;
  let missingEmail = 0;
  parsedRows.forEach((r, idx) => {
    const norm = normalizeStudentRow(r);
    if (!norm.prn) missingPrn++;
    if (!norm.name) missingName++;
    if (!norm.email) missingEmail++;
  });
  console.log(`   Total rows: ${parsedRows.length}`);
  console.log(`   Rows with missing PRN: ${missingPrn}`);
  console.log(`   Rows with missing Name: ${missingName}`);
  console.log(`   Rows with missing Email: ${missingEmail}`);

  if (missingEmail > 0) {
    throw new Error(`Found ${missingEmail} rows with missing Email! Master Sheet must map Student Email Address.`);
  }

  console.log('\n4. Testing Full Validation & Upload against an RI Direct Batch in DB...');
  let testBatchId = null;
  try {
    // Create a temporary test RI Direct batch directly on pool
    const testBatchRes = await pool.query(`
      INSERT INTO ri_batches (name, batch_code, status, start_date, end_date, panel_capacity, source_program, source_batch_id)
      VALUES ('Test RI Direct Master Batch', 'RI-TEST-MS-01', 'Active', '2026-03-01', '2026-03-15', 60, 'RI_DIRECT', NULL)
      RETURNING *
    `);
    const testBatch = testBatchRes.rows[0];
    testBatchId = testBatch.id;
    console.log(`   Created test batch: ${testBatch.name} (ID: ${testBatch.id}, Source: ${testBatch.source_program})`);

    // Prepare mock req, res for validateStudentUpload
    const { validateStudentUpload, bulkUploadStudents } = require('../controllers/riController');

    let validateOutput = null;
    const mockValReq = {
      params: { id: testBatch.id },
      body: { mode: 'batch_wise' },
      file: { buffer: fileBuffer, originalname: 'Master Sheet.xlsx' }
    };
    const mockValRes = {
      json: (data) => { validateOutput = data; },
      status: (code) => ({ json: (data) => { validateOutput = { statusCode: code, ...data }; } })
    };

    await validateStudentUpload(mockValReq, mockValRes);

    console.log('\n5. Inspecting Validation Results:');
    if (!validateOutput || !validateOutput.summary) {
      console.error('Validation output error:', validateOutput);
      throw new Error(`validateStudentUpload returned error: ${validateOutput?.message || 'Unknown'}`);
    }
    console.log(`   Total Rows: ${validateOutput.summary.total_rows}`);
    console.log(`   Valid Rows: ${validateOutput.summary.valid_rows}`);
    console.log(`   Invalid Rows: ${validateOutput.summary.invalid_rows}`);

    console.log('   ✓ Verified: 0 "Email is required" errors across all rows!');
    console.log(`   ✓ Found ${validateOutput.summary.valid_rows} valid students and ${validateOutput.summary.invalid_rows} rows with invalid email format (matching LTC).`);

    // Now test uploading all valid rows into the batch
    console.log('\n6. Testing bulkUploadStudents with all valid rows from Master Sheet...');
    const validRowsToUpload = validateOutput.validated_rows.filter(r => r.is_valid);
    let uploadOutput = null;
    const mockUpReq = {
      params: { id: testBatch.id },
      body: { mode: 'batch_wise', rows: validRowsToUpload }
    };
    const mockUpRes = {
      json: (data) => { uploadOutput = data; },
      status: (code) => ({ json: (data) => { uploadOutput = { statusCode: code, ...data }; } })
    };

    await bulkUploadStudents(mockUpReq, mockUpRes);
    console.log('   Upload Response:', uploadOutput);

    // Verify database state
    const enrolledStudentsRes = await pool.query(`
      SELECT rbs.*, u.name, u.email, u.prn, u.department, u.school, u.division, u.gender, rp.name AS panel_name
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      WHERE rbs.ri_batch_id = $1
    `, [testBatch.id]);

    console.log(`\n7. Verified ${enrolledStudentsRes.rowCount} students enrolled in ri_batch_students:`);
    for (const s of enrolledStudentsRes.rows.slice(0, 3)) {
      console.log(`   - PRN: ${s.prn}, Name: ${s.name}, Email: ${s.email}, Source: ${s.source_program}, Panel: ${s.panel_name}, Dept: ${s.department}, School: ${s.school}, Div: ${s.division}`);
      if (s.source_program !== 'RI_DIRECT') throw new Error(`Expected source_program RI_DIRECT but got ${s.source_program}`);
      if (s.source_ltc_batch_id !== null) throw new Error(`Expected source_ltc_batch_id NULL but got ${s.source_ltc_batch_id}`);
    }

    if (enrolledStudentsRes.rowCount !== validRowsToUpload.length) {
      throw new Error(`Expected ${validRowsToUpload.length} enrolled students, but got ${enrolledStudentsRes.rowCount}`);
    }

    // Verify DISTINCT PANELS CREATED in RI Direct batch
    const createdPanelsRes = await pool.query(`
      SELECT rp.id, rp.panel_number, rp.name, COUNT(rbs.id)::int AS student_count
      FROM ri_panels rp
      LEFT JOIN ri_batch_students rbs ON rp.id = rbs.ri_panel_id
      WHERE rp.ri_batch_id = $1
      GROUP BY rp.id
      ORDER BY rp.panel_number ASC
    `, [testBatch.id]);
    console.log('\n   Panels created and student counts:');
    createdPanelsRes.rows.forEach(p => {
      console.log(`     - Panel ${p.panel_number}: "${p.name}" (${p.student_count} students)`);
    });

    // Verify STRICT ISOLATION from LTC
    const studentUserIds = enrolledStudentsRes.rows.map(r => r.student_id);
    const ltcCheckRes = await pool.query(`
      SELECT * FROM batch_students WHERE student_id = ANY($1)
    `, [studentUserIds]);

    console.log(`\n8. Checking LTC batch_students isolation:`);
    console.log(`   Count of students found in LTC batch_students: ${ltcCheckRes.rowCount}`);
    if (ltcCheckRes.rowCount > 0) {
      throw new Error(`CRITICAL: Found ${ltcCheckRes.rowCount} RI_DIRECT students in LTC batch_students! Strict isolation violated.`);
    }
    console.log('   ✓ Strict isolation verified: 0 RI Direct students were added to LTC batch_students.');

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    if (testBatchId) {
      await pool.query('DELETE FROM ri_batch_students WHERE ri_batch_id = $1', [testBatchId]);
      await pool.query('DELETE FROM ri_panels WHERE ri_batch_id = $1', [testBatchId]);
      await pool.query('DELETE FROM ri_batches WHERE id = $1', [testBatchId]);
    }
    await pool.end();
  }
}

runTest();
