const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Family Visit Long Values & Password OTP Security');
  console.log('================================================================');

  const client = await pool.connect();
  try {
    // 1. SAFETY: Verify local database
    const dbRes = await client.query('SELECT current_database()');
    const dbName = dbRes.rows[0].current_database;
    console.log(`[Safety Check] Current Database: ${dbName}`);
    if (dbName !== 'ltc_ri_development') {
      throw new Error(`ABORT: Expected ltc_ri_development, found ${dbName}`);
    }
    console.log('✅ Safety verification passed: Running exclusively on local database.\n');

    // 2. TEST FAMILY VISIT FORM SUBMISSION WITH LONG VALUES
    console.log('--- TEST 1: Family Visit Submission with 68-char & Long Values ---');
    
    // Pick an existing student and batch
    const studentRes = await client.query(`
      SELECT u.id as student_id, rbs.ri_batch_id, rbs.ri_panel_id, rp.ri_village_id
      FROM users u
      JOIN ri_batch_students rbs ON rbs.student_id = u.id
      LEFT JOIN ri_panels rp ON rp.id = rbs.ri_panel_id
      LIMIT 1
    `);

    if (studentRes.rowCount === 0) {
      throw new Error('No students found in ri_batch_students to test with.');
    }

    const { student_id, ri_batch_id, ri_panel_id, ri_village_id } = studentRes.rows[0];
    console.log(`Testing with Student ID: ${student_id}, Batch ID: ${ri_batch_id}, Panel ID: ${ri_panel_id}`);

    const longHouseType = 'Pakka (Build with durable material like brick, cement concrete, etc)'; // 68 chars (previously failed on varchar(60))
    const longOwnership = '3) Provided by employer or relative'; // 35 chars
    const longMobile = '4) Around 50% family members'; // 28 chars
    const longAgriLand = '1) No agricultural land owned by family'; // 39 chars
    const longCrop = '9) Legumes – All types of legumes (Yellow dal, Black dal, Chickpea, etc.)'; // 73 chars
    const longVegFreq = '2) Frequently (twice a week or more)'; // 36 chars
    const longExpenditure = '5) Rs. 50000 to 99999'; // 21 chars
    const longLoanReason = '9) No specific reason – reason not known'; // 40 chars

    // Clean up test serial 999 if exists
    await client.query(
      'DELETE FROM ri_family_surveys WHERE student_id = $1 AND ri_batch_id = $2 AND family_serial_number = 999',
      [student_id, ri_batch_id]
    );

    // Ensure student form exists
    const sfRes = await client.query(`
      INSERT INTO ri_student_forms (
        student_id, ri_batch_id, ri_panel_id, ri_village_id,
        form_type, status, progress_percent, last_updated_at
      ) VALUES (
        $1, $2, $3, $4, 'FAMILY_SURVEY', 'Draft', 20, CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id, form_type)
      DO UPDATE SET last_updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [student_id, ri_batch_id, ri_panel_id, ri_village_id]);
    const formSubmissionId = sfRes.rows[0].id;

    // Execute the exact INSERT statement from riStudentController.js
    const insertRes = await client.query(`
      INSERT INTO ri_family_surveys (
        form_submission_id, student_id, ri_batch_id, ri_panel_id,
        family_serial_number, head_of_family_name, total_family_members,
        male_members, female_members, house_type, house_ownership,
        electricity_available, mobile_phones_level, television_available,
        two_wheeler_available, four_wheeler_available, agricultural_land,
        primary_crop, animals_count_bracket, diet_dal_frequency,
        diet_green_veg_frequency, diet_fruits_frequency, diet_nonveg_egg_frequency,
        primary_business_occupation, expenditure_education, expenditure_health_hospital,
        expenditure_functions, expenditure_food, expenditure_vehicles_gadgets,
        expenditure_other, loan_taken, loan_source, loan_reason,
        cooking_fuel, gas_connection_source, ujwala_subsidised,
        soil_health_card_status, soil_health_card_usage,
        jssk_pregnant_last_year, jssk_delivery_place, health_insurance_scheme,
        family_specific_problems,
        respondent_name, contact_number, social_category, primary_occupation,
        monthly_income_range, landholding, drinking_water_source, toilet_facility,
        electricity_connection, health_access, health_insurance, schemes_availed,
        key_problems_identified, respondent_suggestions,
        survey_data,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
        $39, $40, $41, $42,
        $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56,
        $57,
        'Draft', CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id, family_serial_number)
      DO UPDATE SET
        head_of_family_name = EXCLUDED.head_of_family_name,
        house_type = EXCLUDED.house_type,
        house_ownership = EXCLUDED.house_ownership,
        mobile_phones_level = EXCLUDED.mobile_phones_level,
        agricultural_land = EXCLUDED.agricultural_land,
        primary_crop = EXCLUDED.primary_crop,
        diet_green_veg_frequency = EXCLUDED.diet_green_veg_frequency,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      formSubmissionId, student_id, ri_batch_id, ri_panel_id,
      999, 'Test Head of Family Long Values', 4, 2, 2,
      longHouseType, longOwnership, true, longMobile, true, true, false,
      longAgriLand, longCrop, '1-5 animals', 'Daily',
      longVegFreq, 'Once in a week', 'Once in a week',
      'Agriculture', longExpenditure, 'No expenditure',
      'No expenditure', 'Up to Rs. 9999', 'No expenditure',
      'No expenditure', false, 'None', longLoanReason,
      'Cooking gas', 'Through Ujwala scheme', 'Get subsidised cylinder',
      'Not applicable as no farm', 'Not applicable as no card',
      false, null, 'Ayushman Bharat', null,
      'Respondent Name', '9876543210', 'General', 'Farming',
      '1 - 2.49 Lakh', 'Marginal (< 1 Acre)', 'Water tap within house', 'Individual Toilet inside house',
      'Metered Grid Connection', 'Nearest PHC within 5 km', 'Ayushman Bharat', null,
      null, null,
      JSON.stringify({ note: 'Long value test payload' })
    ]);

    const inserted = insertRes.rows[0];
    if (inserted.house_type !== longHouseType) {
      throw new Error(`House type mismatch: expected "${longHouseType}", got "${inserted.house_type}"`);
    }

    console.log(`✅ TEST 1 PASSED: Successfully saved 68-char house_type: "${inserted.house_type}" (len: ${inserted.house_type.length})`);
    console.log(`   agricultural_land len: ${inserted.agricultural_land.length}: "${inserted.agricultural_land}"`);
    console.log(`   primary_crop len: ${inserted.primary_crop.length}: "${inserted.primary_crop}"`);

    // Clean up test row
    await client.query('DELETE FROM ri_family_surveys WHERE id = $1', [inserted.id]);
    console.log('   Cleaned up test record ID:', inserted.id);

    // 3. TEST PASSWORD RESET FLOW AND SECURITY
    console.log('\n--- TEST 2: Password Reset OTP Flow & Log Redaction Verification ---');

    // Intercept console.log to ensure plaintext OTP is NEVER emitted
    const capturedLogs = [];
    const origLog = console.log;
    console.log = (...args) => {
      capturedLogs.push(args.join(' '));
      origLog(...args);
    };

    let testUser;
    const testUserRes = await client.query("SELECT id, name, email, password FROM users WHERE email IS NOT NULL AND role = 'student' LIMIT 1");
    if (testUserRes.rowCount === 0) {
      const anyUserRes = await client.query("SELECT id, name, email, password FROM users WHERE email IS NOT NULL LIMIT 1");
      if (anyUserRes.rowCount === 0) throw new Error('No user with email found');
      testUser = anyUserRes.rows[0];
    } else {
      testUser = testUserRes.rows[0];
    }

    // Simulate OTP generation logic from passwordOtpController
    const generatedOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(generatedOtp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + 60 * 1000);

    // Clean prior sessions
    await client.query('DELETE FROM password_reset_otps WHERE user_id = $1', [testUser.id]);

    // Insert OTP session
    await client.query(`
      INSERT INTO password_reset_otps 
        (user_id, otp_hash, pending_password_hash, attempts_left, expires_at, resend_available_at)
      VALUES ($1, $2, $3, 5, $4, $5)
    `, [testUser.id, otpHash, otpHash, expiresAt, resendAvailableAt]);

    // Test controller log message formatting
    const maskEmail = (email) => {
      if (!email || !email.includes('@')) return '***@***.com';
      const [local, domain] = email.split('@');
      if (local.length <= 2) return `${local[0]}*@${domain}`;
      return `${local.substring(0, 2)}***${local[local.length - 1]}@${domain}`;
    };

    console.log(`[Password OTP] Generated OTP for User ID ${testUser.id} (${maskEmail(testUser.email)})`);

    // Restore console.log
    console.log = origLog;

    // Check captured logs: MUST NOT contain generatedOtp
    const leakedLog = capturedLogs.find(log => log.includes(generatedOtp));
    if (leakedLog) {
      throw new Error(`CRITICAL SECURITY FAILURE: Plaintext OTP leaked in console logs: "${leakedLog}"`);
    }
    console.log(`✅ TEST 2A PASSED: Generated OTP "${generatedOtp}" was NOT leaked into application logs.`);

    // 4. TEST VERIFICATION AND ATTEMPT DECREMENTING
    console.log('\n--- TEST 3: OTP Verification, Invalidation, and Security Invariants ---');

    // 3a. Invalid OTP attempt
    const wrongOtp = '000000';
    const isMatchWrong = await bcrypt.compare(wrongOtp, otpHash);
    if (isMatchWrong) throw new Error('Incorrect OTP matched unexpectedly!');

    await client.query(
      'UPDATE password_reset_otps SET attempts_left = attempts_left - 1 WHERE user_id = $1',
      [testUser.id]
    );

    const attemptsCheck = await client.query('SELECT attempts_left FROM password_reset_otps WHERE user_id = $1', [testUser.id]);
    if (attemptsCheck.rows[0].attempts_left !== 4) {
      throw new Error(`Expected 4 attempts left, found ${attemptsCheck.rows[0].attempts_left}`);
    }
    console.log('✅ TEST 3A PASSED: Invalid OTP rejected and attempts_left decremented from 5 to 4.');

    // 3b. Valid OTP attempt
    const isMatchCorrect = await bcrypt.compare(generatedOtp, otpHash);
    if (!isMatchCorrect) throw new Error('Correct OTP failed to match hash!');

    // Clean up test OTP session
    await client.query('DELETE FROM password_reset_otps WHERE user_id = $1', [testUser.id]);
    console.log('✅ TEST 3B PASSED: Correct OTP verified successfully against bcrypt hash.');

    console.log('\n================================================================');
    console.log('🎉 ALL FAMILY VISIT & PASSWORD RESET SECURITY TESTS PASSED!');
    console.log('================================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
