const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { sendEmail } = require('../services/emailService');

/**
 * Helper to mask user email address for security UI feedback
 * Example: john.doe@mitwpu.edu.in -> j***e@mitwpu.edu.in
 */
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

/**
 * Resolves a real delivery email for password reset OTP.
 * Students frequently have internal system emails ending in @lifeawakening.internal.
 * In those cases, route to the linked parent email or genuine personal email.
 */
const resolveNotificationEmail = async (userId, userEmail) => {
  if (userEmail && !userEmail.toLowerCase().endsWith('@lifeawakening.internal')) {
    return userEmail;
  }
  try {
    const res = await pool.query(`
      SELECT p.email as parent_email, u.personal_email, u.parent_email as direct_parent_email
      FROM users u
      LEFT JOIN parent_students ps ON ps.student_id = u.id
      LEFT JOIN users p ON p.id = ps.parent_id
      WHERE u.id = $1
      ORDER BY ps.is_primary DESC NULLS LAST, ps.created_at ASC NULLS LAST, p.id ASC
      LIMIT 1
    `, [userId]);

    if (res.rowCount > 0) {
      const row = res.rows[0];
      if (row.parent_email && !row.parent_email.toLowerCase().endsWith('@lifeawakening.internal')) {
        return row.parent_email;
      }
      if (row.direct_parent_email && !row.direct_parent_email.toLowerCase().endsWith('@lifeawakening.internal')) {
        return row.direct_parent_email;
      }
      if (row.personal_email && !row.personal_email.toLowerCase().endsWith('@lifeawakening.internal')) {
        return row.personal_email;
      }
    }
  } catch (err) {
    console.error('[resolveNotificationEmail Error]', err.message);
  }
  return null;
};

/**
 * Beautiful, responsive HTML template for Password Reset OTP emails (LTC + RI Unified)
 */
const buildPasswordOtpEmailHtml = (userName, otp, isResend = false) => `
  <div style="background-color: #f1f5f9; padding: 36px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.05);">
            
            <!-- Header with subtle Blue-to-Green Gradient representing LTC + RI -->
            <tr>
              <td style="background-color: #0b4ca0; background: linear-gradient(135deg, #0b4ca0 0%, #0369a1 48%, #047857 100%); padding: 30px 24px; text-align: center; color: #ffffff;">
                <div style="font-size: 11px; font-weight: 800; color: #bfdbfe; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
                  MIT-WPU LIFE TRANSFORMATION CENTER
                </div>
                <div style="font-size: 12px; font-weight: 700; color: #a7f3d0; letter-spacing: 0.6px; margin-bottom: 12px;">
                  LTC + Rural Immersion
                </div>
                <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; color: #ffffff; line-height: 1.3;">
                  ${isResend ? 'New Password Reset Code' : 'Password Reset Verification'}
                </h2>
              </td>
            </tr>

            <!-- Body Content Area (White background with strong readability) -->
            <tr>
              <td style="padding: 32px 28px; background-color: #ffffff;">
                <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px 0; font-weight: 600; line-height: 1.5;">
                  Hello <strong>${userName || 'Student'}</strong>,
                </p>

                <p style="font-size: 14.5px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
                  You requested to change your account password. Please use the following 6-digit verification code to complete your password update:
                </p>

                <!-- Prominent, Centered OTP Code Box -->
                <div style="text-align: center; margin: 28px 0;">
                  <div style="display: inline-block; background-color: #f0fdfa; border: 2px dashed #0d9488; border-radius: 14px; padding: 18px 36px; box-shadow: 0 4px 14px rgba(13, 148, 136, 0.08);">
                    <span style="font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #0f172a; font-family: 'Courier New', Courier, monospace; display: inline-block; padding-left: 10px;">
                      ${otp}
                    </span>
                  </div>
                </div>

                <!-- 10-Minute Validity & Security Callout -->
                <div style="background-color: #f8fafc; border-left: 4px solid #0d9488; border-radius: 6px; padding: 14px 16px; margin-bottom: 26px;">
                  <p style="margin: 0; font-size: 13.5px; color: #475569; line-height: 1.5;">
                    ⏱️ This code is valid for <strong>10 minutes</strong>. For security purposes, do not share this code with anyone.
                  </p>
                </div>

                <!-- Sign-off -->
                <p style="font-size: 14px; color: #334155; margin: 0 0 6px 0; font-weight: 600;">
                  Have a great day!
                </p>
                <p style="font-size: 13.5px; color: #64748b; margin: 0; line-height: 1.6;">
                  Warm regards,<br />
                  <strong style="color: #0f172a;">MIT-WPU LTC + RI Team</strong>
                </p>
              </td>
            </tr>

            <!-- Footer Area -->
            <tr>
              <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  This is an automated notification for the integrated MIT-WPU Life Transformation Center and Rural Immersion portal.
                </p>
                <p style="margin: 0; font-size: 11.5px; color: #cbd5e1; line-height: 1.5;">
                  If you did not request a password change, please ignore this email or contact support.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
`;

// ============================================================================
// TEMPORARY BYPASS TOGGLE FOR SUPERADMIN PASSWORD RESET OTP
// Set to true to temporarily bypass OTP for Super Admin password changes.
// Set to false to reactivate strict OTP verification.
// Can also be controlled via process.env.BYPASS_SUPERADMIN_PASSWORD_OTP.
// ============================================================================
const BYPASS_SUPERADMIN_PASSWORD_OTP = process.env.BYPASS_SUPERADMIN_PASSWORD_OTP !== undefined
  ? process.env.BYPASS_SUPERADMIN_PASSWORD_OTP === 'true'
  : true; // Temporarily bypassed as requested by user

/**
 * Step 1: Request Password Reset OTP
 * Validates current password, generates 6-digit OTP, saves pending bcrypt hashed password & OTP,
 * and emails OTP to user.
 */
const requestPasswordOtp = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }

  try {
    // 1. Verify user & current password
    const userRes = await pool.query('SELECT id, name, email, password, role FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = userRes.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    // TEMPORARY BYPASS: If bypass is active and caller is superadmin, update password directly without OTP
    if (BYPASS_SUPERADMIN_PASSWORD_OTP && (user.role === 'superadmin' || req.user.role === 'superadmin')) {
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET password = $1, password_changed = true WHERE id = $2',
        [newPasswordHash, userId]
      );
      // Clean up any pending OTPs for this user
      await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [userId]);

      try {
        const { writeAudit } = require('../utils/helpers');
        writeAudit(userId, user.name || 'Superadmin', 'PASSWORD_CHANGED_DIRECT_BYPASS', 'users', userId, {
          email: user.email,
          note: 'OTP temporarily bypassed for Superadmin'
        });
      } catch (_) {}

      console.log(`[Password OTP] Temporarily bypassed OTP for Super Admin ID ${userId} (${user.email})`);

      return res.json({
        success: true,
        bypassed: true,
        message: 'Password updated successfully! (OTP verification temporarily bypassed)'
      });
    }

    // 2. Check resend cooldown / rate limit
    const existingOtpRes = await pool.query(
      'SELECT resend_available_at FROM password_reset_otps WHERE user_id = $1',
      [userId]
    );

    const now = new Date();
    if (existingOtpRes.rowCount > 0) {
      const resendAvailableAt = new Date(existingOtpRes.rows[0].resend_available_at);
      if (resendAvailableAt > now) {
        const remainingSeconds = Math.ceil((resendAvailableAt.getTime() - now.getTime()) / 1000);
        return res.status(429).json({
          message: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
          cooldownSeconds: remainingSeconds
        });
      }
    }

    // 3. Generate 6-digit OTP and hashes
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const pendingPasswordHash = await bcrypt.hash(newPassword, 10);

    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 mins
    const resendAvailableAt = new Date(now.getTime() + 60 * 1000); // 60s cooldown

    // 4. Save/upsert OTP record (clear previous ones first)
    await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [userId]);
    await pool.query(
      `INSERT INTO password_reset_otps 
        (user_id, otp_hash, pending_password_hash, attempts_left, expires_at, resend_available_at)
       VALUES ($1, $2, $3, 5, $4, $5)`,
      [userId, otpHash, pendingPasswordHash, expiresAt, resendAvailableAt]
    );

    // 5. Resolve actual delivery email (avoiding internal placeholder)
    const targetEmail = await resolveNotificationEmail(userId, user.email);
    const maskedEmail = targetEmail ? maskEmail(targetEmail) : 'Registered Contact Email';

    // 5. Secure log (no plaintext OTP)
    console.log(`[Password OTP] Generated OTP for User ID ${userId} (${maskedEmail})`);

    // 6. Send OTP Email
    const htmlBody = buildPasswordOtpEmailHtml(user.name, otp, false);

    if (targetEmail) {
      try {
        await sendEmail({
          to: targetEmail,
          subject: 'Password Reset Verification Code - MIT-WPU LTC + RI Portal',
          html: htmlBody,
          text: `Your password reset verification code is: ${otp}. It will expire in 10 minutes.`
        });
      } catch (emailErr) {
        console.error(`[Password OTP] Email dispatch failed for user ${userId}:`, emailErr.message);
        // In dev environment, proceed with response so user can enter OTP logged in console
      }
    }

    return res.json({
      message: 'Verification OTP sent to your registered email.',
      email: maskedEmail,
      expiresAt: expiresAt.toISOString(),
      cooldownSeconds: 60
    });
  } catch (err) {
    console.error('[Password OTP] requestPasswordOtp error:', err);
    return res.status(500).json({ message: 'Server error while sending OTP.', error: err.message });
  }
};

/**
 * Step 2: Resend Password Reset OTP
 * Enforces 60-second cooldown and generates a fresh OTP for active reset requests.
 */
const resendPasswordOtp = async (req, res) => {
  const userId = req.user.id;
  const now = new Date();

  try {
    const otpRes = await pool.query(
      'SELECT id, resend_available_at, expires_at FROM password_reset_otps WHERE user_id = $1',
      [userId]
    );

    if (otpRes.rowCount === 0) {
      return res.status(400).json({ message: 'No active OTP verification session. Please re-enter your password details.' });
    }

    const record = otpRes.rows[0];

    // Check expiry
    if (new Date(record.expires_at) < now) {
      await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [userId]);
      return res.status(400).json({ message: 'OTP session expired. Please re-enter your current and new password.' });
    }

    // Check resend cooldown
    const resendAvailableAt = new Date(record.resend_available_at);
    if (resendAvailableAt > now) {
      const remainingSeconds = Math.ceil((resendAvailableAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({
        message: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
        cooldownSeconds: remainingSeconds
      });
    }

    // Fetch user details
    const userRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) return res.status(404).json({ message: 'User not found.' });
    const user = userRes.rows[0];

    // Generate new OTP & hash
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const newExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const newResendAvailableAt = new Date(now.getTime() + 60 * 1000);

    // Update DB record
    await pool.query(
      `UPDATE password_reset_otps 
       SET otp_hash = $1, attempts_left = 5, expires_at = $2, resend_available_at = $3
       WHERE user_id = $4`,
      [otpHash, newExpiresAt, newResendAvailableAt, userId]
    );

    // Resolve actual delivery email
    const targetEmail = await resolveNotificationEmail(userId, user.email);
    const maskedEmail = targetEmail ? maskEmail(targetEmail) : 'Registered Contact Email';

    // Secure log (no plaintext OTP)
    console.log(`[Password OTP] Resent OTP for User ID ${userId} (${maskedEmail})`);

    // Send email
    const htmlBody = buildPasswordOtpEmailHtml(user.name, otp, true);

    if (targetEmail) {
      try {
        await sendEmail({
          to: targetEmail,
          subject: 'New Password Reset Verification Code - MIT-WPU LTC + RI Portal',
          html: htmlBody,
          text: `Your new password reset verification code is: ${otp}. It will expire in 10 minutes.`
        });
      } catch (emailErr) {
        console.error(`[Password OTP] Email resend failed for user ${userId}:`, emailErr.message);
      }
    }

    return res.json({
      message: 'A new verification OTP has been sent to your email.',
      expiresAt: newExpiresAt.toISOString(),
      cooldownSeconds: 60
    });
  } catch (err) {
    console.error('[Password OTP] resendPasswordOtp error:', err);
    return res.status(500).json({ message: 'Server error while resending OTP.', error: err.message });
  }
};

/**
 * Step 3: Verify OTP & Change Password
 * Verifies submitted OTP against stored hash, updates user's password, and invalidates OTP.
 */
const verifyPasswordOtp = async (req, res) => {
  const { otp } = req.body;
  const userId = req.user.id;
  const now = new Date();

  if (!otp || String(otp).trim().length !== 6) {
    return res.status(400).json({ message: 'Please enter a valid 6-digit verification code.' });
  }

  try {
    // TEMPORARY BYPASS: If bypass is active and user is superadmin, allow instant verification
    if (BYPASS_SUPERADMIN_PASSWORD_OTP && req.user && req.user.role === 'superadmin') {
      const otpRes = await pool.query('SELECT * FROM password_reset_otps WHERE user_id = $1', [userId]);
      if (otpRes.rowCount > 0) {
        const record = otpRes.rows[0];
        await pool.query('UPDATE users SET password = $1, password_changed = true WHERE id = $2', [record.pending_password_hash, userId]);
        await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [userId]);
        return res.json({
          success: true,
          bypassed: true,
          message: 'Password changed successfully! (OTP bypassed)'
        });
      }
    }

    const otpRes = await pool.query('SELECT * FROM password_reset_otps WHERE user_id = $1', [userId]);

    if (otpRes.rowCount === 0) {
      return res.status(400).json({ message: 'No active OTP verification session. Please request a new OTP.' });
    }

    const record = otpRes.rows[0];

    // Check expiry
    if (new Date(record.expires_at) < now) {
      await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [userId]);
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    // Check attempts left
    if (record.attempts_left <= 0) {
      await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [userId]);
      return res.status(400).json({ message: 'Maximum verification attempts exceeded. Please request a new OTP.' });
    }

    // Verify OTP using bcrypt
    const isOtpValid = await bcrypt.compare(String(otp).trim(), record.otp_hash);

    if (!isOtpValid) {
      const remainingAttempts = record.attempts_left - 1;
      if (remainingAttempts <= 0) {
        await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [userId]);
        return res.status(400).json({ message: 'Incorrect OTP. Maximum attempts reached. Please request a new OTP.' });
      } else {
        await pool.query(
          'UPDATE password_reset_otps SET attempts_left = $1 WHERE user_id = $2',
          [remainingAttempts, userId]
        );
        return res.status(400).json({
          message: `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`,
          attemptsLeft: remainingAttempts
        });
      }
    }

    // OTP Verified! Update user password in users table
    await pool.query('UPDATE users SET password = $1, password_changed = true WHERE id = $2', [record.pending_password_hash, userId]);

    // Delete OTP record immediately after successful verification
    await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [userId]);

    // Optional audit log
    try {
      const { writeAudit } = require('../utils/helpers');
      const userRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0] || {};
      writeAudit(userId, user.name || 'User', 'PASSWORD_CHANGED_VIA_OTP', 'users', userId, { email: user.email });
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Password changed successfully!'
    });
  } catch (err) {
    console.error('[Password OTP] verifyPasswordOtp error:', err);
    return res.status(500).json({ message: 'Server error while verifying OTP.', error: err.message });
  }
};

module.exports = {
  requestPasswordOtp,
  resendPasswordOtp,
  verifyPasswordOtp,
  BYPASS_SUPERADMIN_PASSWORD_OTP
};
