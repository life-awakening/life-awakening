const pool = require('../config/db');
const { calculateRiEvaluation } = require('../utils/riEvaluationCalculator');
const { RI_ACTIVITIES, RI_ACTIVITY_KEYS } = require('../utils/riConstants');

async function runTests() {
  console.log('🧪 Starting Comprehensive RI Activity Attendance Verification Tests...\n');

  try {
    // 1. Verify Constants
    console.log('1. Checking RI Activity Constants...');
    if (RI_ACTIVITY_KEYS.length !== 4) {
      throw new Error(`Expected 4 activity keys, got ${RI_ACTIVITY_KEYS.length}`);
    }
    const expectedKeys = ['SCHOOL_ACTIVITY', 'INSTITUTIONAL_VISIT', 'FAMILY_SURVEY', 'COMMUNITY_PROJECT'];
    for (const k of expectedKeys) {
      if (!RI_ACTIVITY_KEYS.includes(k)) {
        throw new Error(`Missing expected key: ${k}`);
      }
    }
    console.log('   ✅ RI Activity Constants verified successfully.');

    // 2. Test Rubric Evaluation Calculator
    console.log('\n2. Testing Rubric Calculator for 4 activities (5 marks each, max 20)...');
    
    // Case A: All 4 Present -> 20 marks
    const resAll4 = calculateRiEvaluation({
      school_activity_status: 'Present',
      institutional_visit_status: 'Present',
      family_survey_status: 'Present',
      community_project_status: 'Present'
    });
    console.log(`   Case A: 4/4 Present -> Attendance Marks = ${resAll4.attendance_marks} / 20`);
    if (resAll4.attendance_marks !== 20) throw new Error('Expected 20 marks for 4 present activities');

    // Case B: 2 Present, 2 Absent -> 10 marks
    const res2 = calculateRiEvaluation({
      school_activity_status: 'Present',
      institutional_visit_status: 'Absent',
      family_survey_status: 'Present',
      community_project_status: 'Absent'
    });
    console.log(`   Case B: 2/4 Present -> Attendance Marks = ${res2.attendance_marks} / 20`);
    if (res2.attendance_marks !== 10) throw new Error('Expected 10 marks for 2 present activities');

    // Case C: 0 Present, 4 Absent -> 0 marks
    const res0 = calculateRiEvaluation({
      school_activity_status: 'Absent',
      institutional_visit_status: 'Absent',
      family_survey_status: 'Absent',
      community_project_status: 'Absent'
    });
    console.log(`   Case C: 0/4 Present -> Attendance Marks = ${res0.attendance_marks} / 20`);
    if (res0.attendance_marks !== 0) throw new Error('Expected 0 marks for 0 present activities');
    console.log('   ✅ Rubric Evaluation Calculator verified successfully.');

    // 3. Database Schema & Constraint Verification
    console.log('\n3. Testing Database Schema & Unique Constraint for activity-wise attendance...');
    
    // Create test batch, panel, and student
    const batchRes = await pool.query(`
      INSERT INTO ri_batches (name, batch_code, start_date, end_date, status)
      VALUES ('Test Activity Batch', 'TAB_TEST_${Date.now()}', '2026-10-01', '2026-10-02', 'In Progress')
      RETURNING id
    `);
    const batchId = batchRes.rows[0].id;

    const panelRes = await pool.query(`
      INSERT INTO ri_panels (ri_batch_id, panel_number, name)
      VALUES ($1, 999, 'Test Panel 999')
      RETURNING id
    `, [batchId]);
    const panelId = panelRes.rows[0].id;

    const studentUserRes = await pool.query(`
      INSERT INTO users (name, email, password, prn, role)
      VALUES ('Test Student Act', 'test_student_act_${Date.now()}@mitwpu.edu.in', 'dummy_hash', 'PRN_ACT_${Date.now()}', 'student')
      RETURNING id
    `);
    const studentId = studentUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO ri_batch_students (ri_batch_id, ri_panel_id, student_id)
      VALUES ($1, $2, $3)
    `, [batchId, panelId, studentId]);

    // Test upsert / duplicate prevention on ri_attendance
    await pool.query(`
      INSERT INTO ri_attendance (ri_batch_id, ri_panel_id, student_id, activity, status, marked_by_email)
      VALUES ($1, $2, $3, 'SCHOOL_ACTIVITY', 'Present', 'mentor@mitwpu.edu.in')
      ON CONFLICT (ri_batch_id, ri_panel_id, student_id, activity)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
    `, [batchId, panelId, studentId]);

    // Re-insert with status Absent - should update not create duplicate
    await pool.query(`
      INSERT INTO ri_attendance (ri_batch_id, ri_panel_id, student_id, activity, status, marked_by_email)
      VALUES ($1, $2, $3, 'SCHOOL_ACTIVITY', 'Absent', 'mentor@mitwpu.edu.in')
      ON CONFLICT (ri_batch_id, ri_panel_id, student_id, activity)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
    `, [batchId, panelId, studentId]);

    const countRes = await pool.query(`
      SELECT COUNT(*)::int as cnt, status 
      FROM ri_attendance 
      WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND student_id = $3 AND activity = 'SCHOOL_ACTIVITY'
      GROUP BY status
    `, [batchId, panelId, studentId]);

    if (countRes.rows[0].cnt !== 1 || countRes.rows[0].status !== 'Absent') {
      throw new Error(`Expected exactly 1 record with status Absent, got ${JSON.stringify(countRes.rows)}`);
    }
    console.log('   ✅ ri_attendance uniqueness and upsert behavior verified.');

    // 4. Test Lock Mechanism per activity
    console.log('\n4. Testing Activity-wise Attendance Locks...');
    await pool.query(`
      INSERT INTO ri_attendance_locks (ri_batch_id, ri_panel_id, activity, is_locked, locked_by_email)
      VALUES ($1, $2, 'SCHOOL_ACTIVITY', true, 'faculty@mitwpu.edu.in')
      ON CONFLICT (ri_batch_id, ri_panel_id, activity)
      DO UPDATE SET is_locked = EXCLUDED.is_locked
    `, [batchId, panelId]);

    const lockCheck = await pool.query(`
      SELECT is_locked, activity FROM ri_attendance_locks 
      WHERE ri_batch_id = $1 AND ri_panel_id = $2
    `, [batchId, panelId]);

    if (lockCheck.rows.length !== 1 || !lockCheck.rows[0].is_locked || lockCheck.rows[0].activity !== 'SCHOOL_ACTIVITY') {
      throw new Error(`Lock check failed: ${JSON.stringify(lockCheck.rows)}`);
    }
    console.log('   ✅ ri_attendance_locks per-activity locking verified.');

    // Clean up test data
    await pool.query('DELETE FROM ri_attendance WHERE ri_batch_id = $1', [batchId]);
    await pool.query('DELETE FROM ri_attendance_locks WHERE ri_batch_id = $1', [batchId]);
    await pool.query('DELETE FROM ri_batch_students WHERE ri_batch_id = $1', [batchId]);
    await pool.query('DELETE FROM ri_panels WHERE ri_batch_id = $1', [batchId]);
    await pool.query('DELETE FROM ri_batches WHERE id = $1', [batchId]);
    await pool.query('DELETE FROM users WHERE id = $1', [studentId]);

    console.log('\n🎉 ALL RI ACTIVITY ATTENDANCE INTEGRATION TESTS PASSED PERFECTLY!');
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
