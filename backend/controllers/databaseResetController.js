const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { sendEmail } = require('../services/emailService');
const { writeAudit } = require('../utils/helpers');

const TARGET_EMAIL_1 = 'ahsanimamkhan06@gmail.com';
const TARGET_EMAIL_2 = 'nk120104@gmail.com';

const MASKED_EMAIL_1 = 'a***6@gmail.com';
const MASKED_EMAIL_2 = 'n***4@gmail.com';

// Explicit allowlist of application tables to reset.
// Sensitive infrastructure tables (users with admin/superadmin roles, audit_logs,
// system_settings, translations, database_reset_otps) are strictly preserved.
const APPROVED_APPLICATION_TABLES = [
  'ri_red_flags',
  'ri_tickets',
  'ri_notifications',
  'ri_attendance_locks',
  'ri_attendance',
  'ri_batch_students',
  'ri_panels',
  'ri_villages',
  'ri_batches',
  'batch_students',
  'batch_faculty',
  'batches',
  'batch_absentees_snapshots',
  'schedules',
  'squad_leaders',
  'attendance_records_v2',
  'attendance_sessions',
  'attendance',
  'evaluations',
  'student_evaluations',
  'final_evaluation_summary',
  'evaluation_logs',
  'red_flags',
  'feedback',
  'documents',
  'document_versions',
  'insurance',
  'tickets',
  'journey_media',
  'certificates',
  'completion_reports',
  'upload_jobs',
  'email_queue',
  'whatsapp_queue',
  'whatsapp_campaigns',
  'whatsapp_campaign_logs',
  'squad_performance_selections',
  'squad_grading_results',
  'squad_grading_audit_logs',
  'user_notifications',
  'notifications',
  'password_reset_otps'
];


// ============================================================================
// TEMPORARY BYPASS TOGGLE FOR DATABASE RESET DUAL-OTP
// Set BYPASS_DATABASE_RESET_DUAL_OTP = true to temporarily bypass Dual-OTP verification.
// Set to false to reactivate strict Dual-OTP email verification.
// Can also be controlled via process.env.BYPASS_DATABASE_RESET_DUAL_OTP.
// ============================================================================
const BYPASS_DATABASE_RESET_DUAL_OTP = process.env.BYPASS_DATABASE_RESET_DUAL_OTP !== undefined
  ? process.env.BYPASS_DATABASE_RESET_DUAL_OTP === 'true'
  : true; // Temporarily bypassed as requested by user

/**
 * Step 1: Request Dual-Email OTPs for Database Reset
 * POST /api/superadmin/reset-database/request-otp
 */
const requestResetOtp = async (req, res) => {
  try {
    // 1. Strict Super Admin check (Read-Only Super Admin must be rejected)
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Full Super Admin privileges required to request database reset.'
      });
    }

    const userId = req.user.id;

    // TEMPORARY BYPASS: Directly issue pre-verified resetSessionToken if bypass is enabled
    if (BYPASS_DATABASE_RESET_DUAL_OTP) {
      // Invalidate previous unconsumed OTP sessions for this user
      await pool.query(
        `UPDATE database_reset_otps SET used = true WHERE user_id = $1 AND used = false`,
        [userId]
      );

      // Generate single-use resetSessionToken (32 random bytes = 64 hex chars)
      const rawResetSessionToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawResetSessionToken).digest('hex');

      // Insert pre-verified session record with 15-min expiry
      await pool.query(
        `INSERT INTO database_reset_otps (
          user_id, email_1, otp_1_hash, email_2, otp_2_hash,
          otp_1_verified, otp_2_verified, reset_session_token_hash, reset_session_expires_at,
          attempts_left, expires_at, resend_available_at
        ) VALUES (
          $1, $2, 'BYPASS', $3, 'BYPASS',
          true, true, $4, NOW() + INTERVAL '15 minutes',
          5, NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '60 seconds'
        )`,
        [userId, TARGET_EMAIL_1, TARGET_EMAIL_2, tokenHash]
      );

      writeAudit(
        userId,
        req.user.name || 'Superadmin',
        'DATABASE_RESET_OTP_BYPASS',
        'database',
        null,
        { message: 'Database reset Dual-OTP verification temporarily bypassed' }
      );

      return res.json({
        success: true,
        bypassed: true,
        resetSessionToken: rawResetSessionToken,
        message: 'Dual-OTP verification is temporarily bypassed for Super Admin. You may proceed directly to confirmation.',
        expiresInSeconds: 900
      });
    }

    // 2. Cooldown check: prevent spamming OTP requests within 60 seconds
    const activeRes = await pool.query(
      `SELECT id, resend_available_at, expires_at, attempts_left 
       FROM database_reset_otps 
       WHERE user_id = $1 AND used = false AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (activeRes.rows.length > 0) {
      const active = activeRes.rows[0];
      const now = new Date();
      if (active.resend_available_at && new Date(active.resend_available_at) > now) {
        const remainingSeconds = Math.ceil((new Date(active.resend_available_at) - now) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSeconds}s before requesting new verification codes.`,
          retryAfterSeconds: remainingSeconds
        });
      }
    }

    // 3. Generate two independent cryptographically secure 6-digit OTPs
    const rawOtp1 = crypto.randomInt(100000, 1000000).toString();
    const rawOtp2 = crypto.randomInt(100000, 1000000).toString();

    // 4. Hash both OTPs with bcrypt (never store or log plaintext OTPs)
    const saltRounds = 10;
    const otp1Hash = await bcrypt.hash(rawOtp1, saltRounds);
    const otp2Hash = await bcrypt.hash(rawOtp2, saltRounds);

    // 5. Invalidate previous unconsumed OTP sessions for this user
    await pool.query(
      `UPDATE database_reset_otps SET used = true WHERE user_id = $1 AND used = false`,
      [userId]
    );

    // 6. Insert new record with 10-minute expiry and 60-second resend cooldown
    await pool.query(
      `INSERT INTO database_reset_otps (
        user_id, email_1, otp_1_hash, email_2, otp_2_hash,
        attempts_left, expires_at, resend_available_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        5, NOW() + INTERVAL '10 minutes', NOW() + INTERVAL '60 seconds'
      )`,
      [userId, TARGET_EMAIL_1, otp1Hash, TARGET_EMAIL_2, otp2Hash]
    );

    // 7. Dispatch emails asynchronously with high-security notification
    const emailSubject = 'CRITICAL: Database Reset Authorization Verification Code';
    const emailHtml1 = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 8px; background-color: #ffffff;">
        <div style="background-color: #dc2626; color: white; padding: 16px; border-radius: 6px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">LTC SYSTEM SECURITY ALERT</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Database Reset Authorization (Part 1 of 2)</p>
        </div>
        <div style="padding: 24px 0;">
          <p style="font-size: 15px; color: #374151;">A permanent database reset request was initiated by Super Admin <strong>${req.user.name || req.user.email || 'Superadmin'}</strong>.</p>
          <div style="background-color: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #991b1b; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Security Verification Code #1</p>
            <span style="font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 6px; color: #b91c1c;">${rawOtp1}</span>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
            • This code expires in <strong>10 minutes</strong>.<br/>
            • Both Code #1 and Code #2 are required to proceed.<br/>
            • If you did not initiate this request, contact system security immediately.
          </p>
        </div>
      </div>
    `;

    const emailHtml2 = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 8px; background-color: #ffffff;">
        <div style="background-color: #dc2626; color: white; padding: 16px; border-radius: 6px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">LTC SYSTEM SECURITY ALERT</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Database Reset Authorization (Part 2 of 2)</p>
        </div>
        <div style="padding: 24px 0;">
          <p style="font-size: 15px; color: #374151;">A permanent database reset request was initiated by Super Admin <strong>${req.user.name || req.user.email || 'Superadmin'}</strong>.</p>
          <div style="background-color: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #991b1b; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Security Verification Code #2</p>
            <span style="font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 6px; color: #b91c1c;">${rawOtp2}</span>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
            • This code expires in <strong>10 minutes</strong>.<br/>
            • Both Code #1 and Code #2 are required to proceed.<br/>
            • If you did not initiate this request, contact system security immediately.
          </p>
        </div>
      </div>
    `;

    // Send emails (log failure gracefully if offline or test, but proceed)
    await Promise.all([
      sendEmail({ to: TARGET_EMAIL_1, subject: emailSubject, html: emailHtml1 }).catch(err =>
        console.error(`[DatabaseReset] Failed sending OTP 1 to ${TARGET_EMAIL_1}:`, err.message)
      ),
      sendEmail({ to: TARGET_EMAIL_2, subject: emailSubject, html: emailHtml2 }).catch(err =>
        console.error(`[DatabaseReset] Failed sending OTP 2 to ${TARGET_EMAIL_2}:`, err.message)
      )
    ]);

    // 8. Audit log (NEVER log raw OTP values)
    writeAudit(
      userId,
      req.user.name || 'Superadmin',
      'DATABASE_RESET_OTP_REQUESTED',
      'database',
      null,
      { recipients: [MASKED_EMAIL_1, MASKED_EMAIL_2] }
    );

    return res.json({
      success: true,
      message: 'Verification codes have been dispatched to authorized administrator emails.',
      maskedEmail1: MASKED_EMAIL_1,
      maskedEmail2: MASKED_EMAIL_2,
      expiresInSeconds: 600,
      resendCooldownSeconds: 60
    });
  } catch (err) {
    console.error('[DatabaseReset] requestResetOtp Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while requesting verification codes.'
    });
  }
};

/**
 * Step 2: Verify Both Independent OTPs
 * POST /api/superadmin/reset-database/verify-otp
 */
const verifyResetOtp = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Full Super Admin privileges required.'
      });
    }

    // TEMPORARY BYPASS: If Dual-OTP verification is bypassed, issue pre-verified resetSessionToken immediately
    if (BYPASS_DATABASE_RESET_DUAL_OTP) {
      await pool.query(
        `UPDATE database_reset_otps SET used = true WHERE user_id = $1 AND used = false`,
        [req.user.id]
      );

      const rawResetSessionToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawResetSessionToken).digest('hex');

      await pool.query(
        `INSERT INTO database_reset_otps (
          user_id, email_1, otp_1_hash, email_2, otp_2_hash,
          otp_1_verified, otp_2_verified, reset_session_token_hash, reset_session_expires_at,
          attempts_left, expires_at, resend_available_at
        ) VALUES (
          $1, $2, 'BYPASS', $3, 'BYPASS',
          true, true, $4, NOW() + INTERVAL '15 minutes',
          5, NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '60 seconds'
        )`,
        [req.user.id, TARGET_EMAIL_1, TARGET_EMAIL_2, tokenHash]
      );

      return res.json({
        success: true,
        bypassed: true,
        resetSessionToken: rawResetSessionToken,
        message: 'Dual-OTP verification temporarily bypassed.'
      });
    }

    const { otp1, otp2 } = req.body;
    if (!otp1 || !otp2) {
      return res.status(400).json({
        success: false,
        message: 'Both Verification Code #1 and Verification Code #2 are mandatory.'
      });
    }

    const cleanOtp1 = String(otp1).trim();
    const cleanOtp2 = String(otp2).trim();

    if (!/^\d{6}$/.test(cleanOtp1) || !/^\d{6}$/.test(cleanOtp2)) {
      return res.status(400).json({
        success: false,
        message: 'Verification codes must each be 6 digits.'
      });
    }

    const userId = req.user.id;

    // Fetch active OTP record
    const otpRecordRes = await pool.query(
      `SELECT * FROM database_reset_otps 
       WHERE user_id = $1 AND used = false AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (otpRecordRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP request found or code has expired. Please request new codes.'
      });
    }

    const record = otpRecordRes.rows[0];

    // Check remaining attempts
    if (record.attempts_left <= 0) {
      // Invalidate the session
      await pool.query(`UPDATE database_reset_otps SET used = true WHERE id = $1`, [record.id]);
      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exhausted. Please request new verification codes.'
      });
    }

    // Verify both OTPs independently
    const isOtp1Valid = await bcrypt.compare(cleanOtp1, record.otp_1_hash);
    const isOtp2Valid = await bcrypt.compare(cleanOtp2, record.otp_2_hash);

    if (!isOtp1Valid || !isOtp2Valid) {
      const remainingAttempts = record.attempts_left - 1;
      if (remainingAttempts <= 0) {
        // Invalidate record immediately
        await pool.query(
          `UPDATE database_reset_otps SET attempts_left = 0, used = true WHERE id = $1`,
          [record.id]
        );
        writeAudit(
          userId,
          req.user.name || 'Superadmin',
          'DATABASE_RESET_OTP_FAILED',
          'database',
          null,
          { reason: 'Attempts exhausted' }
        );
        return res.status(400).json({
          success: false,
          message: 'Invalid verification codes. Maximum attempts reached. Request new codes.',
          attemptsLeft: 0
        });
      }

      await pool.query(
        `UPDATE database_reset_otps SET attempts_left = $1 WHERE id = $2`,
        [remainingAttempts, record.id]
      );

      writeAudit(
        userId,
        req.user.name || 'Superadmin',
        'DATABASE_RESET_OTP_FAILED',
        'database',
        null,
        { attemptsLeft: remainingAttempts }
      );

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code(s). Both codes must match.',
        attemptsLeft: remainingAttempts
      });
    }

    // Both OTPs are valid! Generate single-use resetSessionToken (32 random bytes = 64 hex chars)
    const rawResetSessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetSessionToken).digest('hex');

    // Update record with session token hash, 10 min expiry, mark OTPs verified
    await pool.query(
      `UPDATE database_reset_otps 
       SET reset_session_token_hash = $1,
           reset_session_expires_at = NOW() + INTERVAL '10 minutes',
           otp_1_verified = true,
           otp_2_verified = true
       WHERE id = $2`,
      [tokenHash, record.id]
    );

    writeAudit(
      userId,
      req.user.name || 'Superadmin',
      'DATABASE_RESET_OTP_VERIFIED',
      'database',
      null,
      { status: 'Session token issued' }
    );

    return res.json({
      success: true,
      message: 'Both verification codes successfully verified.',
      resetSessionToken: rawResetSessionToken,
      expiresInSeconds: 600
    });
  } catch (err) {
    console.error('[DatabaseReset] verifyResetOtp Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while verifying verification codes.'
    });
  }
};

/**
 * Step 3: Atomic Database Reset Execution
 * POST /api/superadmin/reset-database
 */
const executeDatabaseReset = async (req, res) => {
  // 1. Role Guard: Full Super Admin only
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Full Super Admin privileges required to execute database reset.'
    });
  }

  const { resetSessionToken, confirmation } = req.body;

  // 2. Exact confirmation string check
  if (confirmation !== 'RESET DATABASE') {
    return res.status(400).json({
      success: false,
      message: 'Invalid confirmation string. Must type exactly "RESET DATABASE".'
    });
  }

  // 3. Token presence check
  if (!resetSessionToken || typeof resetSessionToken !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Missing or invalid reset session token. Complete dual OTP verification first.'
    });
  }

  const tokenHash = crypto.createHash('sha256').update(resetSessionToken).digest('hex');
  const client = await pool.connect();

  try {
    // 4. Begin PostgreSQL Transaction
    await client.query('BEGIN');

    // 5. Exclusive Row Lock with NOWAIT for Concurrency Protection
    let sessionRow;
    try {
      const lockRes = await client.query(
        `SELECT * FROM database_reset_otps 
         WHERE reset_session_token_hash = $1 
         FOR UPDATE NOWAIT`,
        [tokenHash]
      );
      if (lockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid or nonexistent reset session token.'
        });
      }
      sessionRow = lockRes.rows[0];
    } catch (lockErr) {
      if (lockErr.code === '55P03') {
        // Lock could not be obtained due to concurrent execution
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'A database reset operation is already in progress for this session.'
        });
      }
      throw lockErr;
    }

    // 6. Validate Session Invariants in Locked State
    if (sessionRow.used) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This reset session token has already been consumed. Request a new reset session.'
      });
    }

    if (!sessionRow.otp_1_verified || !sessionRow.otp_2_verified) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Dual-OTP verification incomplete. Reset rejected.'
      });
    }

    const now = new Date();
    if (new Date(sessionRow.reset_session_expires_at) <= now) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Reset session token has expired. Please initiate a new reset request.'
      });
    }

    // 7. Atomically Consume Session Token Inside Transaction
    // If anything fails afterwards, ROLLBACK reverts used back to false
    await client.query(
      `UPDATE database_reset_otps SET used = true WHERE id = $1`,
      [sessionRow.id]
    );

    // 4. Discover which approved tables exist in this database
    const existingTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const existingTableNames = new Set(existingTablesRes.rows.map(r => r.table_name));

    // Filter to only approved application tables that actually exist
    const safeTablesToReset = APPROVED_APPLICATION_TABLES.filter(t => existingTableNames.has(t));

    // 5. Execute Truncation/Deletion of approved application data tables (both LTC and RI)
    for (const table of safeTablesToReset) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch (truncErr) {
        try {
          await client.query(`DELETE FROM "${table}"`);
        } catch (delErr) {
          console.warn(`[DatabaseReset] Warning: Could not clear table ${table}:`, delErr.message);
        }
      }
    }

    // 6. Delete non-admin application users (Strictly preserves Admin, Super Admin, Support, RI Admin, and RI Super Admin)
    await client.query(`
      DELETE FROM users 
      WHERE role NOT IN ('admin', 'superadmin', 'superadmin_readonly', 'ri_admin', 'superadmin-ri', 'superadmin_ri_readonly', 'superadmin-ri-readonly', 'gallery', 'support')
        AND LOWER(email) NOT IN ('superadmin@ri.edu', 'admin@ri.edu.in', 'superadmin@ltc.edu', 'admin@ltc.edu', 'admin@ltc.edu.in', 'gallery@ltc.edu', 'support@mitwpu.edu.in', 'jeeten@mitwpu.edu.in')
    `);

    // Ensure core administrative accounts always exist with valid credentials after reset
    const defaultPasswordHash = await bcrypt.hash('Pppp0000@', 10);
    
    // RI Super Admin
    const riSuperadminRes = await client.query("SELECT id FROM users WHERE LOWER(email) = 'superadmin@ri.edu'");
    if (riSuperadminRes.rowCount === 0) {
      await client.query(`
        INSERT INTO users (name, email, password, role, status, created_at)
        VALUES ('RI Super Admin', 'superadmin@ri.edu', $1, 'superadmin-ri', 'active', NOW())
      `, [defaultPasswordHash]);
    } else {
      await client.query(`
        UPDATE users SET role = 'superadmin-ri', status = 'active', password = $1
        WHERE LOWER(email) = 'superadmin@ri.edu'
      `, [defaultPasswordHash]);
    }

    // RI Admin
    const riAdminRes = await client.query("SELECT id FROM users WHERE LOWER(email) = 'admin@ri.edu.in'");
    if (riAdminRes.rowCount === 0) {
      await client.query(`
        INSERT INTO users (name, email, password, role, status, created_at)
        VALUES ('RI Admin', 'admin@ri.edu.in', $1, 'ri_admin', 'active', NOW())
      `, [defaultPasswordHash]);
    }

    // LTC Super Admin
    const ltcSuperadminRes = await client.query("SELECT id FROM users WHERE LOWER(email) = 'superadmin@ltc.edu'");
    if (ltcSuperadminRes.rowCount === 0) {
      await client.query(`
        INSERT INTO users (name, email, password, role, status, created_at)
        VALUES ('Super Admin', 'superadmin@ltc.edu', $1, 'superadmin', 'active', NOW())
      `, [defaultPasswordHash]);
    }

    // LTC Admin
    const ltcAdminRes = await client.query("SELECT id FROM users WHERE LOWER(email) = 'admin@ltc.edu'");
    if (ltcAdminRes.rowCount === 0) {
      await client.query(`
        INSERT INTO users (name, email, password, role, status, created_at)
        VALUES ('Admin User', 'admin@ltc.edu', $1, 'admin', 'active', NOW())
      `, [defaultPasswordHash]);
    }

    // Ensure Support User credentials are permanently guaranteed and active
    const defaultSupportPassword = process.env.SUPPORT_DEFAULT_PASSWORD || 'Support@123';
    const existingSupport = await client.query("SELECT id FROM users WHERE email = 'support@mitwpu.edu.in' OR role = 'support'");
    if (existingSupport.rowCount === 0) {
      const supportHashed = await bcrypt.hash(defaultSupportPassword, 10);
      await client.query(
        "INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, 'active')",
        ['LTC Support', 'support@mitwpu.edu.in', supportHashed, 'support']
      );
    } else {
      await client.query(
        "UPDATE users SET role = 'support', status = 'active' WHERE email = 'support@mitwpu.edu.in' OR id = $1",
        [existingSupport.rows[0].id]
      );
    }

    // Also guarantee alias/legacy account role if present
    await client.query(
      "UPDATE users SET role = 'support' WHERE email = 'jeeten@mitwpu.edu.in'"
    );

    // 11. Write In-Transaction Audit Log
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.id,
        req.user.name || 'Superadmin',
        'DATABASE_RESET_SUCCESS',
        'database',
        null,
        JSON.stringify({
          tablesResetCount: safeTablesToReset.length,
          tablesReset: safeTablesToReset,
          adminAndSupportAccountsPreserved: true,
          timestamp: new Date().toISOString()
        })
      ]
    );

    // 12. Commit Transaction
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Database reset successfully. Application data reset; Admin, Super Admin, and Support accounts preserved.'
    });
  } catch (err) {
    // 13. On Error: Rollback completely
    await client.query('ROLLBACK');
    console.error('[DatabaseReset] executeDatabaseReset Error:', err);

    writeAudit(
      req.user.id,
      req.user.name || 'Superadmin',
      'DATABASE_RESET_FAILURE',
      'database',
      null,
      { error: err.message }
    );

    return res.status(500).json({
      success: false,
      message: 'Database reset failed and has been rolled back.',
      error: err.message
    });
  } finally {
    client.release();
  }
};
module.exports = {
  requestResetOtp,
  verifyResetOtp,
  executeDatabaseReset,
  APPROVED_APPLICATION_TABLES,
  TARGET_EMAIL_1,
  TARGET_EMAIL_2,
  BYPASS_DATABASE_RESET_DUAL_OTP
};
