const http = require('http');
const XLSX = require('xlsx');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

async function run() {
  console.log('=== TESTING MULTIPART FORM-DATA FACULTY UPLOAD (.XLSX, .CSV, .XLS) ===');

  // 1. Get an active RI batch and its panels
  const batchRes = await pool.query(`SELECT id, name FROM ri_batches ORDER BY id ASC LIMIT 1`);
  if (batchRes.rowCount === 0) {
    console.error('No RI batch found!');
    process.exit(1);
  }
  const batch = batchRes.rows[0];
  console.log(`Testing with Batch: ${batch.name} (ID: ${batch.id})`);

  const panelsRes = await pool.query(`SELECT id, panel_number, name FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC`, [batch.id]);
  console.log(`Found ${panelsRes.rowCount} panels in this batch.`);
  const panel1 = panelsRes.rows[0];

  // 2. Create JWT token
  const token = jwt.sign(
    { id: 1, email: 'admin@college.edu', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Helper to make multipart HTTP request
  function sendMultipart(endpoint, fields, fileField) {
    return new Promise((resolve, reject) => {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const chunks = [];

      // Append text fields
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && v !== null) {
          chunks.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
          ));
        }
      }

      // Append file
      if (fileField) {
        chunks.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType || 'application/octet-stream'}\r\n\r\n`
        ));
        chunks.push(fileField.buffer);
        chunks.push(Buffer.from('\r\n'));
      }

      chunks.push(Buffer.from(`--${boundary}--\r\n`));
      const body = Buffer.concat(chunks);

      const req = http.request({
        hostname: 'localhost',
        port: 5001,
        path: endpoint,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }, (res) => {
        let respData = '';
        res.on('data', d => { respData += d; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(respData);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, rawBody: respData });
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // TEST 1: Validate XLSX file (Batch-wise)
  console.log('\n--- 1. Testing .xlsx Batch-Wise Validation via Multipart POST ---');
  const sampleXlsxData = [
    {
      'Name': 'Dr. Test Batchwise',
      'Email': 'dr.batchwise@college.edu',
      'Panel': `Panel ${panel1.panel_number}`,
      'Mobile Number': '9876543210',
      'Department': 'Computer Science',
      'Designation': 'Associate Professor',
      'Employee ID': 'EMP001',
      'Role': 'Lead Mentor'
    },
    {
      'Name': 'Prof. Invalid Panel Test',
      'Email': 'invalid.p@college.edu',
      'Panel': 'Unknown Panel 999',
      'Mobile Number': '9876543211',
      'Department': 'Mechanical',
      'Designation': 'Assistant Professor',
      'Employee ID': 'EMP002',
      'Role': 'Mentor'
    }
  ];
  const wb1 = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(sampleXlsxData);
  XLSX.utils.book_append_sheet(wb1, ws1, 'Sheet1');
  const xlsxBuffer = XLSX.write(wb1, { type: 'buffer', bookType: 'xlsx' });

  const res1 = await sendMultipart(
    `/api/ri/batches/${batch.id}/faculty/validate-upload`,
    { upload_mode: 'batch_wise' },
    { name: 'file', filename: 'test_faculty.xlsx', buffer: xlsxBuffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );

  console.log('Status:', res1.status);
  console.log('Summary:', res1.body?.summary);
  if (res1.status === 200 && res1.body?.summary?.valid_rows === 1 && res1.body?.summary?.invalid_rows === 1) {
    console.log('✅ TEST 1 PASSED: Validated .xlsx batch-wise file correctly!');
  } else {
    console.error('❌ TEST 1 FAILED:', res1);
    process.exit(1);
  }

  // TEST 2: Validate CSV file (Panel-wise)
  console.log('\n--- 2. Testing .csv Panel-Wise Validation via Multipart POST ---');
  const csvContent = `Name,Email,Mobile Number,Department,Designation,Employee ID,Role
Prof. CSV Panelwise,csv.panelwise@college.edu,9876543222,Civil Engineering,Assistant Professor,EMP003,Mentor
Dr. Second CSV Mentor,second.csv@college.edu,9876543223,Civil Engineering,Professor,EMP004,Mentor`;

  const csvBuffer = Buffer.from(csvContent, 'utf-8');

  const res2 = await sendMultipart(
    `/api/ri/batches/${batch.id}/faculty/validate-upload`,
    { upload_mode: 'panel_wise', ri_panel_id: panel1.id },
    { name: 'file', filename: 'faculty_panelwise.csv', buffer: csvBuffer, contentType: 'text/csv' }
  );

  console.log('Status:', res2.status);
  console.log('Summary:', res2.body?.summary);
  if (res2.status === 200 && res2.body?.summary?.valid_rows === 2) {
    console.log('✅ TEST 2 PASSED: Validated .csv panel-wise file correctly!');
  } else {
    console.error('❌ TEST 2 FAILED:', res2);
    process.exit(1);
  }

  // TEST 3: Bulk Import the Valid Rows
  console.log('\n--- 3. Testing Bulk Import execution with validated rows ---');
  const validRowsToImport = res2.body.validated_rows;
  
  const importRes = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      upload_mode: 'panel_wise',
      ri_panel_id: panel1.id,
      rows: validRowsToImport
    });

    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: `/api/ri/batches/${batch.id}/faculty/bulk-upload`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let respData = '';
      res.on('data', d => { respData += d; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(respData) });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  console.log('Import Status:', importRes.status);
  console.log('Import Result:', importRes.body);
  if (importRes.status === 200 && importRes.body.imported_count >= 1) {
    console.log('✅ TEST 3 PASSED: Bulk faculty records inserted successfully!');
  } else {
    console.error('❌ TEST 3 FAILED:', importRes);
    process.exit(1);
  }

  // Verify DB
  const checkDb = await pool.query(
    `SELECT * FROM ri_batch_faculty WHERE ri_batch_id = $1 AND email IN ('csv.panelwise@college.edu', 'second.csv@college.edu')`,
    [batch.id]
  );
  console.log(`\nVerified ${checkDb.rowCount} faculty rows in PostgreSQL table ri_batch_faculty:`);
  checkDb.rows.forEach(r => console.log(` - ${r.name} (${r.email}) -> Panel ID ${r.ri_panel_id}`));

  console.log('\n✨ ALL MULTIPART & PARSER TESTS PASSED FLAWLESSLY!');
  await pool.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
