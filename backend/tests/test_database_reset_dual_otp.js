require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
process.env.BYPASS_DATABASE_RESET_DUAL_OTP = 'false';
const assert = require('assert');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const {
  requestResetOtp,
  verifyResetOtp,
  executeDatabaseReset,
  TARGET_EMAIL_1
} = require('../controllers/databaseResetController');

// Mock response helper
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
  console.log('TEST SUITE: Secure Single-Email OTP Database Reset Verification');
  console.log('================================================================\n');

  let testUserId = null;

  try {
    // 1. Verify Target Email Recipient
    console.log('[Test 1] Verifying target email recipient...');
    assert.strictEqual(TARGET_EMAIL_1, 'ahsanimamkhan06@gmail.com', 'Target Email 1 must be ahsanimamkhan06@gmail.com');
    console.log('  ✔ Target email is strictly configured to ahsanimamkhan06@gmail.com');

    // Find an existing superadmin user for mock request authentication
    const userRes = await pool.query(`SELECT id, role, name, email FROM users WHERE role = 'superadmin' LIMIT 1`);
    if (userRes.rows.length === 0) {
      throw new Error('No superadmin user found in database for testing.');
    }
    const superadminUser = userRes.rows[0];
    testUserId = superadminUser.id;

    // Clean up any lingering test OTP rows for this user before starting
    await pool.query(`DELETE FROM database_reset_otps WHERE user_id = $1`, [testUserId]);

    // 2. Role Guards (Reject non-superadmin roles)
    console.log('\n[Test 2] Testing Role Guards for non-superadmin callers...');
    const rolesToTest = ['admin', 'faculty', 'student', 'superadmin_readonly'];
    for (const role of rolesToTest) {
      const mockReq = { user: { id: 9999, role, name: 'Attacker' } };
      const mockResReq = createMockRes();
      await requestResetOtp(mockReq, mockResReq);
      assert.strictEqual(mockResReq.statusCode, 403, `requestResetOtp must return 403 for role: ${role}`);

      const mockResVer = createMockRes();
      await verifyResetOtp({ ...mockReq, body: { otp: '123456' } }, mockResVer);
      assert.strictEqual(mockResVer.statusCode, 403, `verifyResetOtp must return 403 for role: ${role}`);

      const mockResExec = createMockRes();
      await executeDatabaseReset({ ...mockReq, body: { resetSessionToken: 'token', confirmation: 'RESET DATABASE' } }, mockResExec);
      assert.strictEqual(mockResExec.statusCode, 403, `executeDatabaseReset must return 403 for role: ${role}`);
    }
    console.log('  ✔ All non-superadmin roles correctly rejected with 403 Forbidden');

    // 3. Request Single OTP
    console.log('\n[Test 3] Requesting Security Verification Code as Superadmin...');
    const reqOtpReq = { user: superadminUser };
    const reqOtpRes = createMockRes();
    await requestResetOtp(reqOtpReq, reqOtpRes);

    assert.strictEqual(reqOtpRes.statusCode, 200, 'requestResetOtp must return 200 on success');
    assert.strictEqual(reqOtpRes.data.success, true, 'Response must indicate success');
    assert(!reqOtpRes.data.bypassOtp, 'Response MUST NOT have bypassOtp');
    assert(!reqOtpRes.data.resetSessionToken, 'requestResetOtp MUST NOT issue a resetSessionToken');
    assert.strictEqual(reqOtpRes.data.expiresInSeconds, 600, 'Expiry must be 600 seconds');

    // Check database row
    const otpRowRes = await pool.query(
      `SELECT * FROM database_reset_otps WHERE user_id = $1 AND used = false ORDER BY created_at DESC LIMIT 1`,
      [testUserId]
    );
    assert.strictEqual(otpRowRes.rows.length, 1, 'OTP record must be created in database');
    const otpRow = otpRowRes.rows[0];
    assert.strictEqual(otpRow.email_1, 'ahsanimamkhan06@gmail.com');
    assert.strictEqual(otpRow.otp_1_verified, false, 'otp_1_verified must be false initially');
    assert.strictEqual(otpRow.reset_session_token_hash, null, 'reset_session_token_hash must be null initially');
    console.log('  ✔ Database record created with bcrypt hash, not verified');

    // 4. Incorrect OTP Testing
    console.log('\n[Test 4] Testing verification failure with incorrect OTP...');
    const failReq = {
      user: superadminUser,
      body: { otp: '000000' }
    };
    const failRes = createMockRes();
    await verifyResetOtp(failReq, failRes);
    assert.strictEqual(failRes.statusCode, 400, 'Incorrect OTP must return 400');
    assert.strictEqual(failRes.data.success, false);
    assert.strictEqual(failRes.data.attemptsLeft, 4, 'Attempts left must be decremented to 4');

    const updatedRow = (await pool.query(`SELECT attempts_left FROM database_reset_otps WHERE id = $1`, [otpRow.id])).rows[0];
    assert.strictEqual(updatedRow.attempts_left, 4);
    console.log('  ✔ Incorrect OTP rejected and attempts_left decremented to 4');

    // 5. Missing / Invalid OTP Format Testing
    console.log('\n[Test 5] Testing invalid format and missing OTP inputs...');
    const invalidFormats = [
      { otp: '' },
      { otp: '12345' }, // 5 digits
      { otp: 'abcdef' }, // non-numeric
      { otp: null }
    ];
    for (const body of invalidFormats) {
      const res = createMockRes();
      await verifyResetOtp({ user: superadminUser, body }, res);
      assert.strictEqual(res.statusCode, 400, 'Invalid OTP format or missing OTP must return 400');
    }
    console.log('  ✔ Malformed and missing OTPs strictly rejected');

    // 6. Exhausting Verification Attempts
    console.log('\n[Test 6] Testing attempt exhaustion (invalidation after 5 failed attempts)...');
    // We already used 1 attempt. Let's set attempts_left to 1 and fail once more
    await pool.query(`UPDATE database_reset_otps SET attempts_left = 1 WHERE id = $1`, [otpRow.id]);
    const finalFailRes = createMockRes();
    await verifyResetOtp(failReq, finalFailRes);
    assert.strictEqual(finalFailRes.statusCode, 400);
    assert.strictEqual(finalFailRes.data.attemptsLeft, 0);

    const invalidatedRow = (await pool.query(`SELECT used, attempts_left FROM database_reset_otps WHERE id = $1`, [otpRow.id])).rows[0];
    assert.strictEqual(invalidatedRow.used, true, 'Row must be marked used/invalidated');
    assert.strictEqual(invalidatedRow.attempts_left, 0);
    console.log('  ✔ Session automatically marked as consumed/invalidated when attempts reach 0');

    // 7. Expired OTP Rejection
    console.log('\n[Test 7] Testing expired OTP rejection...');
    // Invalidate prior rows and insert already-expired row
    await pool.query(`UPDATE database_reset_otps SET used = true WHERE user_id = $1`, [testUserId]);
    await pool.query(
      `INSERT INTO database_reset_otps (
        user_id, email_1, otp_1_hash,
        attempts_left, expires_at, resend_available_at
      ) VALUES (
        $1, $2, 'expired_hash',
        5, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '2 minutes'
      )`,
      [testUserId, TARGET_EMAIL_1]
    );
    const expiredRes = createMockRes();
    await verifyResetOtp({ user: superadminUser, body: { otp: '123456' } }, expiredRes);
    assert.strictEqual(expiredRes.statusCode, 400);
    assert(expiredRes.data.message.includes('expired'));
    console.log('  ✔ Expired OTP session correctly rejected');

    // 8. Testing bypass attempts on executeDatabaseReset
    console.log('\n[Test 8] Testing bypass attempts on executeDatabaseReset...');

    // Attempt 8a: Missing token
    const noTokenRes = createMockRes();
    await executeDatabaseReset({ user: superadminUser, body: { confirmation: 'RESET DATABASE' } }, noTokenRes);
    assert.strictEqual(noTokenRes.statusCode, 400, 'Missing resetSessionToken must fail with 400');

    // Attempt 8b: Fake token
    const fakeTokenRes = createMockRes();
    await executeDatabaseReset({
      user: superadminUser,
      body: { resetSessionToken: 'nonexistent_token_hex_1234567890abcdef', confirmation: 'RESET DATABASE' }
    }, fakeTokenRes);
    assert.strictEqual(fakeTokenRes.statusCode, 400, 'Nonexistent token must fail with 400');

    // Attempt 8c: Incorrect confirmation phrase
    const wrongPhraseRes = createMockRes();
    await executeDatabaseReset({
      user: superadminUser,
      body: { resetSessionToken: 'some_token', confirmation: 'reset database' } // lowercase
    }, wrongPhraseRes);
    assert.strictEqual(wrongPhraseRes.statusCode, 400, 'Confirmation phrase case sensitivity check must fail');

    // Attempt 8d: Unverified session (token exists in database but otp_1_verified is false)
    const unverifiedToken = crypto.randomBytes(32).toString('hex');
    const unverifiedHash = crypto.createHash('sha256').update(unverifiedToken).digest('hex');
    await pool.query(
      `INSERT INTO database_reset_otps (
        user_id, email_1, otp_1_hash,
        attempts_left, expires_at, resend_available_at,
        reset_session_token_hash, reset_session_expires_at,
        otp_1_verified
      ) VALUES (
        $1, $2, 'hash1',
        5, NOW() + INTERVAL '10 minutes', NOW() + INTERVAL '1 minute',
        $3, NOW() + INTERVAL '10 minutes',
        false
      )`,
      [testUserId, TARGET_EMAIL_1, unverifiedHash]
    );

    const unverifiedRes = createMockRes();
    await executeDatabaseReset({
      user: superadminUser,
      body: { resetSessionToken: unverifiedToken, confirmation: 'RESET DATABASE' }
    }, unverifiedRes);
    assert.strictEqual(unverifiedRes.statusCode, 400, 'Unverified OTP session must be rejected with 400');
    assert(unverifiedRes.data.message.includes('OTP verification incomplete'));
    console.log('  ✔ All bypass attempts (missing token, fake token, wrong phrase, unverified session) strictly blocked');

    // 9. Successful OTP Verification & Single-Use Session Token Issuance
    console.log('\n[Test 9] Testing successful OTP verification...');
    const validOtp = '555666';
    const validHash = await bcrypt.hash(validOtp, 10);

    // Invalidate prior rows and insert known valid test row
    await pool.query(`UPDATE database_reset_otps SET used = true WHERE user_id = $1`, [testUserId]);
    const validInsertRes = await pool.query(
      `INSERT INTO database_reset_otps (
        user_id, email_1, otp_1_hash,
        attempts_left, expires_at, resend_available_at
      ) VALUES (
        $1, $2, $3,
        5, NOW() + INTERVAL '10 minutes', NOW() + INTERVAL '60 seconds'
      ) RETURNING id`,
      [testUserId, TARGET_EMAIL_1, validHash]
    );
    const validRowId = validInsertRes.rows[0].id;

    const verifySuccessRes = createMockRes();
    await verifyResetOtp({
      user: superadminUser,
      body: { otp: validOtp }
    }, verifySuccessRes);

    assert.strictEqual(verifySuccessRes.statusCode, 200, 'Verification must succeed with 200');
    assert.strictEqual(verifySuccessRes.data.success, true);
    assert(verifySuccessRes.data.resetSessionToken, 'Single-use resetSessionToken must be issued');
    assert.strictEqual(verifySuccessRes.data.resetSessionToken.length, 64, 'Token must be 64 hex chars');

    // Verify database state after successful verification
    const verifiedDbRow = (await pool.query(`SELECT * FROM database_reset_otps WHERE id = $1`, [validRowId])).rows[0];
    assert.strictEqual(verifiedDbRow.otp_1_verified, true, 'otp_1_verified must be true');
    assert(verifiedDbRow.reset_session_token_hash, 'reset_session_token_hash must be saved in DB');
    console.log('  ✔ OTP verified, flag set to true, and 64-char single-use token issued');

    // 10. Verification of Consumed Token Protection (Cannot reuse used token)
    console.log('\n[Test 10] Testing that consumed/used session tokens cannot be reused...');
    // Mark this valid row as used = true
    await pool.query(`UPDATE database_reset_otps SET used = true WHERE id = $1`, [validRowId]);
    const reuseRes = createMockRes();
    await executeDatabaseReset({
      user: superadminUser,
      body: { resetSessionToken: verifySuccessRes.data.resetSessionToken, confirmation: 'RESET DATABASE' }
    }, reuseRes);
    assert.strictEqual(reuseRes.statusCode, 400, 'Consumed token must return 400');
    assert(reuseRes.data.message.includes('already been consumed'));
    console.log('  ✔ Replay attack blocked: consumed session tokens cannot be reused');

    // Clean up test rows
    await pool.query(`DELETE FROM database_reset_otps WHERE user_id = $1`, [testUserId]);

    console.log('\n================================================================');
    console.log('ALL SINGLE-OTP DATABASE RESET TESTS PASSED (10/10)');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    if (testUserId) {
      await pool.query(`DELETE FROM database_reset_otps WHERE user_id = $1`, [testUserId]).catch(() => {});
    }
    await pool.end();
  }
}

runTests();
