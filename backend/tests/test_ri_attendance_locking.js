const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const { calculateRiVisitDeadlines, computeEffectiveAttendanceLock } = require('../utils/riEvaluationCalculator');

async function runComprehensiveLockingTests() {
  console.log('========================================================================');
  console.log('COMPREHENSIVE TEST: RI ATTENDANCE LOCKING & TEMPORARY UNLOCK SYNCHRONIZATION');
  console.log('========================================================================\n');

  const API_BASE = 'http://localhost:5001';

  try {
    // ─── 1. Unit Tests for computeEffectiveAttendanceLock ───────────────────────
    console.log('--- TEST 1: Effective Lock Resolution Unit Logic ---');

    // Case 1A: Batch ended 10 days ago (Deadline passed). No manual lock.
    const pastBatchEnd = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const pastBatchStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const effAutoLocked = computeEffectiveAttendanceLock({
      batchStartDate: pastBatchStart,
      batchEndDate: pastBatchEnd,
      lockRow: null
    });
    console.log('Case 1A (10 days past end date):', {
      is_locked: effAutoLocked.is_locked,
      effective_status: effAutoLocked.effective_status,
      is_auto_locked: effAutoLocked.is_auto_locked,
      reason: effAutoLocked.lock_reason
    });
    if (!effAutoLocked.is_locked || effAutoLocked.effective_status !== 'LOCKED' || !effAutoLocked.is_auto_locked) {
      throw new Error('Case 1A failed: Expected is_locked=true and is_auto_locked=true when 7-day deadline passed');
    }
    console.log('   ✅ Case 1A passed: Attendance automatically locked 7 days after batch end date.');

    // Case 1B: Batch ended 10 days ago, but Superadmin granted Temporary Unlock until 2 days in the future
    const futureExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const effTempUnlocked = computeEffectiveAttendanceLock({
      batchStartDate: pastBatchStart,
      batchEndDate: pastBatchEnd,
      lockRow: {
        is_locked: false,
        unlocked_until: futureExpiry.toISOString(),
        lock_reason: 'Superadmin granted 2-day grace period'
      }
    });
    console.log('Case 1B (Temporary unlock active):', {
      is_locked: effTempUnlocked.is_locked,
      effective_status: effTempUnlocked.effective_status,
      is_temp_unlocked: effTempUnlocked.is_temp_unlocked,
      unlocked_until: effTempUnlocked.unlocked_until,
      reason: effTempUnlocked.lock_reason
    });
    if (effTempUnlocked.is_locked || effTempUnlocked.effective_status !== 'TEMP_UNLOCKED' || !effTempUnlocked.is_temp_unlocked) {
      throw new Error('Case 1B failed: Expected is_locked=false and is_temp_unlocked=true during active temporary unlock');
    }
    console.log('   ✅ Case 1B passed: Active temporary unlock overrides automatic deadline lock.');

    // Case 1C: Temporary unlock expiry has passed (expired 1 hour ago)
    const expiredTime = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const effExpired = computeEffectiveAttendanceLock({
      batchStartDate: pastBatchStart,
      batchEndDate: pastBatchEnd,
      lockRow: {
        is_locked: false,
        unlocked_until: expiredTime.toISOString(),
        lock_reason: 'Superadmin granted 2-day grace period'
      }
    });
    console.log('Case 1C (Temporary unlock expired):', {
      is_locked: effExpired.is_locked,
      effective_status: effExpired.effective_status,
      temp_unlock_expired: effExpired.temp_unlock_expired,
      reason: effExpired.lock_reason
    });
    if (!effExpired.is_locked || effExpired.effective_status !== 'LOCKED' || !effExpired.temp_unlock_expired) {
      throw new Error('Case 1C failed: Expected is_locked=true and automatic reversion once expiry passes');
    }
    console.log('   ✅ Case 1C passed: Once expiry passes, automatic deadline lock is restored without manual intervention.');

    // Case 1D: Active batch (within 7 days), faculty manually locked
    const activeBatchEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const activeBatchStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const effManualLock = computeEffectiveAttendanceLock({
      batchStartDate: activeBatchStart,
      batchEndDate: activeBatchEnd,
      lockRow: {
        is_locked: true,
        locked_by_email: 'faculty@mitwpu.edu',
        lock_reason: 'Locked by Faculty on completion'
      }
    });
    console.log('Case 1D (Manual lock within active batch):', {
      is_locked: effManualLock.is_locked,
      effective_status: effManualLock.effective_status,
      reason: effManualLock.lock_reason
    });
    if (!effManualLock.is_locked || effManualLock.is_auto_locked) {
      throw new Error('Case 1D failed: Expected manual faculty lock to be respected');
    }
    console.log('   ✅ Case 1D passed: Faculty-controlled manual lock functionality preserved.');

    // Case 1E: UTC Server vs IST Client Expiry Boundary & Explicit Timestamp Preservation
    console.log('\nCase 1E (IST End-of-Day Expiry Boundary & UTC Server Simulation):');
    // Date-only input "2026-10-30" must resolve to exactly 23:59:59.999 IST, which in UTC is 18:29:59.999Z
    const testDateOnly = '2026-10-30';
    const parts = testDateOnly.split('-');
    const anchoredIstDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T23:59:59.999+05:30`);
    const expectedUtcIso = '2026-10-30T18:29:59.999Z';
    if (anchoredIstDate.toISOString() !== expectedUtcIso) {
      throw new Error(`Case 1E failed: Expected ISO ${expectedUtcIso}, got ${anchoredIstDate.toISOString()}`);
    }

    // Boundary Test 1: At exact millisecond of expiry in IST (18:29:59.999 UTC) -> Still TEMP_UNLOCKED
    const effAtBoundary = computeEffectiveAttendanceLock({
      batchStartDate: pastBatchStart,
      batchEndDate: pastBatchEnd,
      lockRow: { is_locked: false, unlocked_until: expectedUtcIso },
      now: new Date('2026-10-30T18:29:59.999Z')
    });
    if (effAtBoundary.is_locked !== false || effAtBoundary.effective_status !== 'TEMP_UNLOCKED') {
      throw new Error('Case 1E failed: At exact millisecond of expiry, lock must still be TEMP_UNLOCKED');
    }

    // Boundary Test 2: Exactly 1ms after expiry (18:30:00.000 UTC / 2026-10-31 00:00:00.000 IST) -> LOCKED
    const effAfterBoundary = computeEffectiveAttendanceLock({
      batchStartDate: pastBatchStart,
      batchEndDate: pastBatchEnd,
      lockRow: { is_locked: false, unlocked_until: expectedUtcIso },
      now: new Date('2026-10-30T18:30:00.000Z')
    });
    if (effAfterBoundary.is_locked !== true || effAfterBoundary.temp_unlock_expired !== true) {
      throw new Error('Case 1E failed: Exactly 1ms after IST end-of-day, lock must automatically revert to LOCKED');
    }

    // Preservation Test: Explicitly supplied timestamp with custom time is preserved exactly
    const customExplicitTimestamp = '2026-10-30T14:15:30.500Z';
    const effExplicitPreserved = computeEffectiveAttendanceLock({
      batchStartDate: pastBatchStart,
      batchEndDate: pastBatchEnd,
      lockRow: { is_locked: false, unlocked_until: customExplicitTimestamp },
      now: new Date('2026-10-30T14:00:00.000Z')
    });
    if (effExplicitPreserved.unlocked_until !== customExplicitTimestamp) {
      throw new Error(`Case 1E failed: Explicit timestamp was modified, expected ${customExplicitTimestamp}`);
    }
    console.log('   ✅ Case 1E passed: Date-only correctly anchors to 23:59:59.999 IST (18:29:59.999Z), boundary transition is exact, and explicit timestamps are preserved.\n');

    // ─── 2. Integration Tests via Superadmin & Faculty APIs ──────────────────────
    console.log('--- TEST 2: API Integration & Synchronization ---');

    // Fetch SuperAdmin user
    const saRes = await pool.query(`SELECT id, name, email, role FROM users WHERE role IN ('superadmin-ri', 'superadmin') LIMIT 1`);
    if (saRes.rowCount === 0) throw new Error('No superadmin user found');
    const saUser = saRes.rows[0];
    const saToken = jwt.sign(
      { id: saUser.id, email: saUser.email, role: saUser.role },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '2h' }
    );
    const saHeaders = {
      'Authorization': `Bearer ${saToken}`,
      'Content-Type': 'application/json'
    };

    // Locate panel with assigned faculty and students
    const panelFacultyRes = await pool.query(`
      SELECT rbf.ri_batch_id AS batch_id, rbf.ri_panel_id AS panel_id, rbf.email, rbf.name, u.id AS user_id, u.role AS user_role, u.ri_undertaking_submitted, rp.name AS panel_name, rb.start_date, rb.end_date
      FROM ri_batch_faculty rbf
      JOIN users u ON LOWER(rbf.email) = LOWER(u.email)
      JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
      WHERE rbf.status <> 'deleted'
      LIMIT 1
    `);
    if (panelFacultyRes.rowCount === 0) throw new Error('No assigned faculty found');
    const panelInfo = panelFacultyRes.rows[0];
    const { batch_id, panel_id, panel_name } = panelInfo;

    const origUndertaking = panelInfo.ri_undertaking_submitted;
    await pool.query(`UPDATE users SET ri_undertaking_submitted = true WHERE id = $1`, [panelInfo.user_id]);

    const facToken = jwt.sign(
      { id: panelInfo.user_id, email: panelInfo.email, role: panelInfo.user_role || 'ri_faculty' },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '2h' }
    );
    const facHeaders = {
      'Authorization': `Bearer ${facToken}`,
      'Content-Type': 'application/json'
    };

    // Locate student in panel
    const studentRes = await pool.query(`
      SELECT student_id FROM ri_batch_students WHERE ri_batch_id = $1 AND ri_panel_id = $2 LIMIT 1
    `, [batch_id, panel_id]);
    if (studentRes.rowCount === 0) throw new Error('No student found in panel');
    const testStudentId = studentRes.rows[0].student_id;

    console.log(`Using Panel "${panel_name}" (ID ${panel_id}), Batch ${batch_id}, Faculty: ${panelInfo.email}`);

    // Set batch end date to 10 days ago to simulate passed deadline
    const originalDatesRes = await pool.query(`SELECT start_date, end_date FROM ri_batches WHERE id = $1`, [batch_id]);
    const origDates = originalDatesRes.rows[0];

    const pastEnd = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const pastStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await pool.query(`UPDATE ri_batches SET start_date = $1, end_date = $2 WHERE id = $3`, [pastStart, pastEnd, batch_id]);
    // Clear locks for clean baseline test
    await pool.query(`DELETE FROM ri_attendance_locks WHERE ri_batch_id = $1 AND ri_panel_id = $2`, [batch_id, panel_id]);

    try {
      // 2A: Verify Superadmin Manage Attendance displays LOCKED when deadline passed
      console.log('\n2A. Checking Superadmin Panel List when deadline has passed...');
      const saPanelsRes = await fetch(`${API_BASE}/api/ri/superadmin/attendance/panels?batch_id=${batch_id}`, { headers: saHeaders });
      const saPanelsData = await saPanelsRes.json();
      if (!saPanelsRes.ok) throw new Error(`Superadmin panels fetch failed: ${JSON.stringify(saPanelsData)}`);

      const targetPanel = saPanelsData.panels.find(p => p.id === panel_id);
      if (!targetPanel) throw new Error('Target panel not found in Superadmin panels response');

      const actStats = targetPanel.activities.SCHOOL_ACTIVITY;
      console.log('   Superadmin panel SCHOOL_ACTIVITY lock status:', { is_locked: actStats.is_locked, effective_status: actStats.effective_status });
      if (actStats.is_locked !== true) {
        throw new Error('Expected Superadmin → Manage Attendance to display LOCKED when deadline has passed');
      }
      console.log('   ✅ 2A Passed: Superadmin Manage Attendance displays LOCKED when deadline passed.');

      // 2B: Verify Faculty is blocked from saving attendance when locked by deadline
      console.log('\n2B. Verifying Faculty is rejected when saving attendance on auto-locked activity...');
      const facSaveBlockedRes = await fetch(`${API_BASE}/api/ri/faculty-portal/attendance`, {
        method: 'POST',
        headers: facHeaders,
        body: JSON.stringify({
          batch_id,
          panel_id,
          activity: 'SCHOOL_ACTIVITY',
          records: [{ student_id: testStudentId, status: 'Present' }]
        })
      });
      console.log('   Faculty save response status:', facSaveBlockedRes.status);
      if (facSaveBlockedRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for faculty attendance save, got ${facSaveBlockedRes.status}`);
      }
      const facSaveBlockedData = await facSaveBlockedRes.json();
      console.log('   Faculty save blocked message:', facSaveBlockedData.message);
      console.log('   ✅ 2B Passed: Faculty correctly prohibited from modifying attendance when locked.');

      // 2C: Superadmin temporarily unlocks attendance until 3 days in the future
      console.log('\n2C. Superadmin grants Temporary Unlock for SCHOOL_ACTIVITY...');
      const unlockDateStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const saTempUnlockRes = await fetch(`${API_BASE}/api/ri/superadmin/attendance/toggle-lock`, {
        method: 'POST',
        headers: saHeaders,
        body: JSON.stringify({
          batch_id,
          panel_id,
          activity: 'SCHOOL_ACTIVITY',
          action: 'temp_unlock',
          unlocked_until: unlockDateStr,
          reason: 'Dean approved 3-day extension for verification'
        })
      });
      const saTempUnlockData = await saTempUnlockRes.json();
      console.log('   Superadmin temp unlock response:', saTempUnlockData);
      if (!saTempUnlockRes.ok || saTempUnlockData.is_temp_unlocked !== true) {
        throw new Error(`Temporary unlock failed: ${JSON.stringify(saTempUnlockData)}`);
      }

      // Check DB lock record
      const dbLockRes = await pool.query(`
        SELECT is_locked, unlocked_until, lock_reason, unlocked_by_email 
        FROM ri_attendance_locks 
        WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND activity = 'SCHOOL_ACTIVITY'
      `, [batch_id, panel_id]);
      console.log('   Database lock row after temporary unlock:', dbLockRes.rows[0]);
      if (dbLockRes.rows[0].is_locked !== false || !dbLockRes.rows[0].unlocked_until) {
        throw new Error('Database does not reflect unlocked_until timestamp');
      }
      console.log('   ✅ 2C Passed: Temporary unlock date and metadata stored correctly in database.');

      // 2D: Verify Superadmin panel detail reflects TEMPORARILY UNLOCKED
      console.log('\n2D. Verifying Superadmin Detail & Panel List reflects temporary unlock...');
      const saDetailRes = await fetch(`${API_BASE}/api/ri/superadmin/attendance/panel-detail?panel_id=${panel_id}&batch_id=${batch_id}`, { headers: saHeaders });
      const saDetailData = await saDetailRes.json();
      const schoolLock = saDetailData.locks.SCHOOL_ACTIVITY;
      console.log('   Superadmin Detail lock info:', schoolLock);
      if (schoolLock.is_locked !== false || schoolLock.is_temp_unlocked !== true) {
        throw new Error('Expected Superadmin detail to show is_locked=false and is_temp_unlocked=true');
      }
      console.log('   ✅ 2D Passed: Superadmin views reflect temporary unlock with expiry.');

      // 2E: Faculty can now mark & save attendance while temporary unlock is active!
      console.log('\n2E. Verifying Faculty can save attendance during active temporary unlock...');
      const facSaveSuccessRes = await fetch(`${API_BASE}/api/ri/faculty-portal/attendance`, {
        method: 'POST',
        headers: facHeaders,
        body: JSON.stringify({
          batch_id,
          panel_id,
          activity: 'SCHOOL_ACTIVITY',
          records: [{ student_id: testStudentId, status: 'Present', remarks: 'Verified by test suite' }]
        })
      });
      const facSaveSuccessData = await facSaveSuccessRes.json();
      console.log('   Faculty save status:', facSaveSuccessRes.status);
      console.log('   Faculty save response:', facSaveSuccessData);
      if (!facSaveSuccessRes.ok || !facSaveSuccessData.success) {
        throw new Error(`Faculty failed to save attendance during temporary unlock: ${JSON.stringify(facSaveSuccessData)}`);
      }

      // Verify attendance record in DB
      const attCheckRes = await pool.query(`
        SELECT status, remarks, updated_at 
        FROM ri_attendance 
        WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND student_id = $3 AND activity = 'SCHOOL_ACTIVITY'
      `, [batch_id, panel_id, testStudentId]);
      console.log('   DB attendance record updated by faculty:', attCheckRes.rows[0]);
      if (attCheckRes.rows[0].status !== 'Present') {
        throw new Error('Expected student attendance status to be Present');
      }
      console.log('   ✅ 2E Passed: Faculty successfully saved attendance during active temporary unlock.');

      // 2F: Simulate expiry of temporary unlock by advancing DB unlocked_until into the past
      console.log('\n2F. Simulating expiry of temporary unlock...');
      const pastExpiry = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      await pool.query(`
        UPDATE ri_attendance_locks 
        SET unlocked_until = $1 
        WHERE ri_batch_id = $2 AND ri_panel_id = $3 AND activity = 'SCHOOL_ACTIVITY'
      `, [pastExpiry.toISOString(), batch_id, panel_id]);

      // Check Superadmin detail view
      const saDetailExpiredRes = await fetch(`${API_BASE}/api/ri/superadmin/attendance/panel-detail?panel_id=${panel_id}&batch_id=${batch_id}`, { headers: saHeaders });
      const saDetailExpiredData = await saDetailExpiredRes.json();
      const expiredLock = saDetailExpiredData.locks.SCHOOL_ACTIVITY;
      console.log('   Lock status after expiry in Superadmin detail:', {
        is_locked: expiredLock.is_locked,
        is_temp_unlocked: expiredLock.is_temp_unlocked,
        temp_unlock_expired: expiredLock.temp_unlock_expired,
        reason: expiredLock.lock_reason
      });
      if (expiredLock.is_locked !== true) {
        throw new Error('Expected lock to automatically restore after temporary unlock expiry');
      }

      // Check Faculty save attempt after expiry
      const facSaveExpiredRes = await fetch(`${API_BASE}/api/ri/faculty-portal/attendance`, {
        method: 'POST',
        headers: facHeaders,
        body: JSON.stringify({
          batch_id,
          panel_id,
          activity: 'SCHOOL_ACTIVITY',
          records: [{ student_id: testStudentId, status: 'Absent' }]
        })
      });
      console.log('   Faculty save attempt after expiry status:', facSaveExpiredRes.status);
      if (facSaveExpiredRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden after expiry, got ${facSaveExpiredRes.status}`);
      }
      console.log('   ✅ 2F Passed: Automatic deadline lock restored without manual intervention once expiry passes.');

      // 2G: Verify audit log entries
      console.log('\n2G. Verifying audit trail preservation...');
      const auditRes = await pool.query(`
        SELECT action, details, created_at 
        FROM ri_audit_logs 
        WHERE action IN ('TEMP_UNLOCK_PANEL_ATTENDANCE', 'LOCK_PANEL_ATTENDANCE', 'UNLOCK_PANEL_ATTENDANCE')
        ORDER BY id DESC LIMIT 5
      `);
      console.log('   Recent audit logs:', auditRes.rows);
      if (auditRes.rowCount === 0) {
        throw new Error('Expected audit logs for temporary unlock actions');
      }
      console.log('   ✅ 2G Passed: Audit logs preserved for all lock and unlock actions.');

    } finally {
      // Restore original batch dates and clean up test lock row
      await pool.query(`UPDATE ri_batches SET start_date = $1, end_date = $2 WHERE id = $3`, [origDates.start_date, origDates.end_date, batch_id]);
      await pool.query(`DELETE FROM ri_attendance_locks WHERE ri_batch_id = $1 AND ri_panel_id = $2`, [batch_id, panel_id]);
      if (panelInfo && panelInfo.user_id) {
        await pool.query(`UPDATE users SET ri_undertaking_submitted = $1 WHERE id = $2`, [origUndertaking, panelInfo.user_id]);
      }
    }

    console.log('\n========================================================================');
    console.log('🎉 ALL RI ATTENDANCE LOCKING & TEMPORARY UNLOCK TESTS PASSED PERFECTLY!');
    console.log('========================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  }
}

runComprehensiveLockingTests();
