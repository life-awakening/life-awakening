require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const {
  requestResetOtp,
  verifyResetOtp,
  BYPASS_DATABASE_RESET_DUAL_OTP
} = require('../controllers/databaseResetController');
const {
  requestPasswordOtp,
  verifyPasswordOtp,
  BYPASS_SUPERADMIN_PASSWORD_OTP
} = require('../controllers/passwordOtpController');

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Super Admin Password OTP & Dual-OTP Database Reset Bypass');
  console.log('================================================================\n');

  const client = await pool.connect();
  try {
    // 1. Safety check
    const dbRes = await client.query('SELECT current_database()');
    console.log(`[Safety Check] Current Database: ${dbRes.rows[0].current_database}`);
    assert.strictEqual(BYPASS_DATABASE_RESET_DUAL_OTP, true, 'BYPASS_DATABASE_RESET_DUAL_OTP must default to true');
    assert.strictEqual(BYPASS_SUPERADMIN_PASSWORD_OTP, true, 'BYPASS_SUPERADMIN_PASSWORD_OTP must default to true');
    console.log('✔ Safety checks and bypass toggle defaults verified.\n');

    // Find superadmin user
    const saRes = await client.query("SELECT id, name, email, password, role FROM users WHERE role = 'superadmin' LIMIT 1");
    if (saRes.rowCount === 0) {
      throw new Error('No superadmin user found in database.');
    }
    const superadmin = saRes.rows[0];
    console.log(`Testing with Super Admin: ID=${superadmin.id}, Email=${superadmin.email}`);

    // --- TEST 1: Super Admin Password Change OTP Bypass ---
    console.log('\n--- TEST 1: Super Admin Password Change OTP Bypass ---');

    // 1a: Test rejection on wrong current password
    const mockReqWrong = {
      user: { id: superadmin.id, role: 'superadmin', name: superadmin.name },
      body: { currentPassword: 'DefinitelyWrongPassword123!', newPassword: 'NewValidPassword123!' }
    };
    const mockResWrong = createMockRes();
    await requestPasswordOtp(mockReqWrong, mockResWrong);
    assert.strictEqual(mockResWrong.statusCode, 401, 'Should reject invalid current password');
    console.log('  ✔ Correctly rejected incorrect current password with 401');

    // 1b: Set known temporary password and test bypass update
    const tempInitialPass = 'InitialTempPass123!';
    const initialHash = await bcrypt.hash(tempInitialPass, 10);
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [initialHash, superadmin.id]);

    const newTargetPass = 'UpdatedSecurePass456!';
    const mockReqBypass = {
      user: { id: superadmin.id, role: 'superadmin', name: superadmin.name },
      body: { currentPassword: tempInitialPass, newPassword: newTargetPass }
    };
    const mockResBypass = createMockRes();
    await requestPasswordOtp(mockReqBypass, mockResBypass);

    assert.strictEqual(mockResBypass.statusCode, 200, 'Password update should succeed');
    assert.strictEqual(mockResBypass.data.bypassed, true, 'Response must have bypassed: true');
    assert.strictEqual(mockResBypass.data.success, true, 'Response must have success: true');

    // Verify DB password updated to newTargetPass
    const checkUserRes = await client.query('SELECT password FROM users WHERE id = $1', [superadmin.id]);
    const isNewPassMatch = await bcrypt.compare(newTargetPass, checkUserRes.rows[0].password);
    assert.strictEqual(isNewPassMatch, true, 'Password in database must match new password');
    console.log('  ✔ Super Admin password changed directly with OTP bypassed successfully!');

    // Restore original password
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [superadmin.password, superadmin.id]);
    console.log('  ✔ Restored original Super Admin password.');

    // --- TEST 2: Student / Faculty Password Flow Remains Secure (Not Bypassed) ---
    console.log('\n--- TEST 2: Non-Superadmin (Student/Faculty) Password OTP Remains Active ---');
    const studentRes = await client.query("SELECT id, name, email, password FROM users WHERE role = 'student' AND email IS NOT NULL LIMIT 1");
    if (studentRes.rowCount > 0) {
      const student = studentRes.rows[0];
      const tempStudentPass = 'StudentTempPass123!';
      const studentHash = await bcrypt.hash(tempStudentPass, 10);
      await client.query('UPDATE users SET password = $1 WHERE id = $2', [studentHash, student.id]);

      const mockReqStudent = {
        user: { id: student.id, role: 'student', name: student.name },
        body: { currentPassword: tempStudentPass, newPassword: 'NewStudentPass456!' }
      };
      const mockResStudent = createMockRes();
      await requestPasswordOtp(mockReqStudent, mockResStudent);

      assert.strictEqual(mockResStudent.statusCode, 200);
      assert.strictEqual(mockResStudent.data.bypassed, undefined, 'Student request must NOT be bypassed');
      assert.ok(mockResStudent.data.email, 'Student request must dispatch OTP email');

      // Cleanup
      await client.query('DELETE FROM password_reset_otps WHERE user_id = $1', [student.id]);
      await client.query('UPDATE users SET password = $1 WHERE id = $2', [student.password, student.id]);
      console.log('  ✔ Verified Student accounts strictly require standard OTP email verification.');
    }

    // --- TEST 3: Database Reset Dual-OTP Bypass ---
    console.log('\n--- TEST 3: Database Reset Dual-OTP Bypass ---');

    // 3a: Non-superadmin role rejection
    const mockReqGuard = { user: { id: 9999, role: 'faculty' } };
    const mockResGuard = createMockRes();
    await requestResetOtp(mockReqGuard, mockResGuard);
    assert.strictEqual(mockResGuard.statusCode, 403, 'Non-superadmin must be rejected with 403');
    console.log('  ✔ Non-superadmin correctly blocked with 403');

    // 3b: Super Admin requestResetOtp returns pre-verified resetSessionToken
    const mockReqDbReset = { user: { id: superadmin.id, role: 'superadmin', name: superadmin.name } };
    const mockResDbReset = createMockRes();
    await requestResetOtp(mockReqDbReset, mockResDbReset);

    assert.strictEqual(mockResDbReset.statusCode, 200);
    assert.strictEqual(mockResDbReset.data.bypassed, true, 'Dual-OTP must be flagged as bypassed');
    assert.ok(mockResDbReset.data.resetSessionToken, 'resetSessionToken must be returned directly');

    // Verify database record has otp_1_verified=true and otp_2_verified=true
    const tokenHash = crypto.createHash('sha256').update(mockResDbReset.data.resetSessionToken).digest('hex');
    const sessionRes = await client.query(
      'SELECT otp_1_verified, otp_2_verified, used FROM database_reset_otps WHERE reset_session_token_hash = $1',
      [tokenHash]
    );
    assert.strictEqual(sessionRes.rowCount, 1, 'Pre-verified session row must exist');
    assert.strictEqual(sessionRes.rows[0].otp_1_verified, true, 'otp_1_verified must be true');
    assert.strictEqual(sessionRes.rows[0].otp_2_verified, true, 'otp_2_verified must be true');
    assert.strictEqual(sessionRes.rows[0].used, false, 'used must be false');
    console.log('  ✔ Database reset session pre-verified with Dual-OTP bypassed successfully!');

    // Clean up test session row
    await client.query('DELETE FROM database_reset_otps WHERE user_id = $1', [superadmin.id]);
    console.log('  ✔ Cleaned up test database reset session records.');

    console.log('\n================================================================');
    console.log('🎉 ALL SUPERADMIN OTP BYPASS TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
