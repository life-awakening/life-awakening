const assert = require('assert');
require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../config/db');

async function runTests() {
  console.log('================================================================');
  console.log('   LAP DAY 5 ATTENDANCE SYSTEM-WIDE REMOVAL VERIFICATION        ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✔ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`✖ FAIL: ${name}`);
      console.error(e);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✔ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`✖ FAIL: ${name}`);
      console.error(e);
    }
  }

  // TEST 1: Database has zero records with day = 5
  await testAsync('Database contains zero attendance rows with day = 5 or day > 4', async () => {
    const res = await pool.query('SELECT COUNT(*) AS count FROM attendance WHERE day > 4');
    assert.strictEqual(parseInt(res.rows[0].count, 10), 0);
  });

  // TEST 2: Faculty markAttendance controller rejects day 5
  await testAsync('Faculty markAttendance controller strictly rejects day 5 with 400', async () => {
    const facultyController = require('../controllers/facultyController');
    const req = {
      user: { id: 1, role: 'faculty' },
      body: {
        batchId: 1,
        activity: 'physical',
        day: 5,
        records: [{ studentId: 1001, status: 'present' }]
      }
    };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };
    await facultyController.markAttendance(req, res);
    assert.strictEqual(statusCode, 400);
    assert.ok(responseBody && responseBody.message.includes('Days 1 to 4'));
  });

  // TEST 3: Faculty markAttendance controller rejects day > 4
  await testAsync('Faculty markAttendance controller strictly rejects day 6 with 400', async () => {
    const facultyController = require('../controllers/facultyController');
    const req = {
      user: { id: 1, role: 'faculty' },
      body: {
        batchId: 1,
        activity: 'leadership',
        day: 6,
        records: [{ studentId: 1001, status: 'present' }]
      }
    };
    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };
    await facultyController.markAttendance(req, res);
    assert.strictEqual(statusCode, 400);
    assert.ok(responseBody && responseBody.message.includes('Days 1 to 4'));
  });

  // TEST 4: Student controller getAttendance excludes day > 4
  await testAsync('Student controller getAttendance query enforces day <= 4', async () => {
    const studentController = require('../controllers/studentController');
    const req = {
      user: { id: 1001, role: 'student' }
    };
    let statusCode = 200;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };
    await studentController.getAttendance(req, res);
    assert.strictEqual(statusCode, 200);
    if (responseBody && Array.isArray(responseBody.attendance)) {
      for (const rec of responseBody.attendance) {
        assert.ok(rec.day <= 4, `Expected day <= 4 but got ${rec.day}`);
      }
    }
  });

  // TEST 5: Superadmin squad attendance summary does not return day5
  await testAsync('Superadmin getSquadAttendanceSummary outputs Days 1 to 4 and excludes Day 5', async () => {
    const superadminController = require('../controllers/superadminController');
    let createdBatch = false;
    let batchRow = await pool.query('SELECT id FROM batches LIMIT 1');
    let batchId;
    if (batchRow.rows.length === 0) {
      const ins = await pool.query("INSERT INTO batches (name, status, year) VALUES ('Test Day 5 Batch', 'active', 2026) RETURNING id");
      batchId = ins.rows[0].id;
      createdBatch = true;
    } else {
      batchId = batchRow.rows[0].id;
    }
    const req = {
      query: { batchId }
    };
    let statusCode = 200;
    let responseBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      }
    };
    await superadminController.getSquadAttendanceSummary(req, res);
    assert.strictEqual(statusCode, 200);
    if (responseBody && Array.isArray(responseBody.squads) && responseBody.squads.length > 0) {
      const firstSquad = responseBody.squads[0];
      assert.ok('day1' in firstSquad || 'day1_pct' in firstSquad || 'recorded_days' in firstSquad);
      assert.strictEqual(firstSquad.day5, undefined);
      assert.strictEqual(firstSquad.day5_present, undefined);
    }
    if (createdBatch) {
      await pool.query('DELETE FROM batches WHERE id = $1', [batchId]);
    }
  });

  // TEST 6: Check frontend files do not contain Day 5 attendance matrix or export columns
  test('Frontend files audit: No active Day 5 attendance tabs or matrix columns', () => {
    const fs = require('fs');
    const studentDash = fs.readFileSync(__dirname + '/../../frontend/src/StudentDashboard.jsx', 'utf8');
    assert.ok(!studentDash.includes("['D1', 'D2', 'D3', 'D4', 'D5']"));
    assert.ok(studentDash.includes("['D1', 'D2', 'D3', 'D4']"));

    const facultyDash = fs.readFileSync(__dirname + '/../../frontend/src/FacultyDashboard.jsx', 'utf8');
    assert.ok(!facultyDash.includes("['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']"));
    assert.ok(facultyDash.includes("['Day 1', 'Day 2', 'Day 3', 'Day 4']"));

    const attTab = fs.readFileSync(__dirname + '/../../frontend/src/admin/AttendanceTab.jsx', 'utf8');
    assert.ok(!attTab.includes("{ id: '5', label: 'Day 5' }"));
    assert.ok(!attTab.includes("'Day 5 Attended'"));
    assert.ok(!attTab.includes("'Day 5 Absent'"));

    const exportLtc = fs.readFileSync(__dirname + '/../../frontend/src/utils/exportLtcExcel.js', 'utf8');
    assert.ok(!exportLtc.includes('slice(0, 5)'));
    assert.ok(exportLtc.includes('slice(0, 4)'));
    assert.ok(exportLtc.includes('for (let d = 1; d <= 4; d++)'));
  });

  console.log(`\n================================================================`);
  console.log(`   TEST RESULTS: ${passed}/${total} SUITES PASSED (${Math.round(passed / total * 100)}%)`);
  console.log(`================================================================\n`);

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
