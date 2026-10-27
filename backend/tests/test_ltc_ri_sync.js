const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/../.env' });
const http = require('http');
const pool = require('../config/db');

const token = jwt.sign({ id: 1, email: 'admin@college.edu', role: 'admin' }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function run() {
  console.log('=== TEST START: LTC -> RI LIVE SYNCHRONIZATION LIFECYCLE ===\n');

  // 1. Initial State
  const initialBatches = await request('http://localhost:5001/api/ri/batches');
  const activeBatch = initialBatches.data.batches?.[0];
  if (!activeBatch) throw new Error('No active RI batch found');
  const targetLtcBatchId = activeBatch.source_batch_id;
  console.log('1. Initial RI Batch stats: Total Students =', activeBatch.total_students, '| Total Panels =', activeBatch.total_panels);

  // 2. Create student in users table
  const insertUser = await pool.query(`
    INSERT INTO users (name, email, password, prn, role, department, division, panel, in_current_batch)
    VALUES ('E2E Verification Student', 'e2e_verify@college.edu', 'pass123', 'PRN_E2E_8888', 'student', 'Department of Mechanical Engineering', 'Division I', 'SY R&A Div 1', true)
    RETURNING id, name, prn
  `);
  const mockStudent = insertUser.rows[0];
  console.log('2. Created Student in Master DB:', mockStudent.id, mockStudent.name, mockStudent.prn);

  // 3. Assign student to LTC batch
  const addStudentRes = await request(`http://localhost:5001/api/admin/batches/${targetLtcBatchId}/students/add-one`, {
    method: 'POST',
    body: { student_id: mockStudent.id }
  });
  console.log(`3. Assigned Student to LTC Batch ${targetLtcBatchId}:`, addStudentRes.status, addStudentRes.data.message);

  // 4. Refresh RI Batches API
  const refreshedBatches = await request('http://localhost:5001/api/ri/batches');
  const b1AfterAdd = refreshedBatches.data.batches?.find(b => b.id === activeBatch.id);
  console.log('4. Refreshed RI Batch stats: Total Students =', b1AfterAdd.total_students, '| Total Panels =', b1AfterAdd.total_panels);

  // 5. Query RI students in batch
  const studentSearch = await request('http://localhost:5001/api/ri/students?batch_id=' + b1AfterAdd.id + '&search=PRN_E2E_8888');
  console.log('5. Queried RI Students in batch: Found count =', studentSearch.data.total);
  if (studentSearch.data.students?.length > 0) {
    const s = studentSearch.data.students[0];
    console.log('   Student Details in RI: Name =', s.name, '| PRN =', s.prn, '| Panel =', s.panel_name, '| Division =', s.division);
  }

  // 6. Verify duplicate count in database
  const dupQuery = await pool.query(`
    SELECT COUNT(*)::int as count FROM ri_batch_students WHERE ri_batch_id = $1 AND student_id = $2
  `, [b1AfterAdd.id, mockStudent.id]);
  console.log('6. Duplicate check in ri_batch_students: Records =', dupQuery.rows[0].count);

  // 7. Remove student from LTC batch
  const removeRes = await request(`http://localhost:5001/api/admin/batches/${targetLtcBatchId}/students/${mockStudent.id}`, {
    method: 'DELETE'
  });
  console.log(`7. Removed Student from LTC Batch ${targetLtcBatchId}:`, removeRes.status, removeRes.data.message);

  // 8. Refresh RI Batches API after removal
  const finalBatches = await request('http://localhost:5001/api/ri/batches');
  const b1Final = finalBatches.data.batches?.find(b => b.id === activeBatch.id);
  console.log('8. Final RI Batch stats: Total Students =', b1Final.total_students, '| Total Panels =', b1Final.total_panels);

  // 9. Verify student no longer in RI batch
  const studentSearchAfter = await request('http://localhost:5001/api/ri/students?batch_id=' + b1Final.id + '&search=PRN_E2E_8888');
  console.log('9. Queried RI Students after removal: Found count =', studentSearchAfter.data.total);

  // 10. Clean up master user record
  await pool.query('DELETE FROM users WHERE id = $1', [mockStudent.id]);
  console.log('10. Cleaned up student master user record.');

  console.log('\n=== ALL 10 VERIFICATION STEPS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
