const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { sendEmail } = require('../services/emailService');
const { logRiAction } = require('../utils/riAudit');

/**
 * Mask email address for privacy and UI display
 * e.g., ahsan.khan@mitwpu.edu.in -> a***n@mitwpu.edu.in
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
 * Responsive HTML email template for RI Faculty Password Reset OTP
 */
const buildFacultyOtpEmailHtml = (facultyName, otp, isResend = false) => `
  <div style="background-color: #f1f5f9; padding: 36px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.05);">
            
            <!-- Header with Emerald Gradient representing Rural Immersion -->
            <tr>
              <td style="background-color: #047857; background: linear-gradient(135deg, #064e3b 0%, #047857 52%, #059669 100%); padding: 30px 24px; text-align: center; color: #ffffff;">
                <div style="font-size: 11px; font-weight: 800; color: #a7f3d0; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
                  MIT-WPU RURAL IMMERSION PROGRAM
                </div>
                <div style="font-size: 12px; font-weight: 700; color: #d1fae5; letter-spacing: 0.6px; margin-bottom: 12px;">
                  Faculty Mentor Portal
                </div>
                <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; color: #ffffff; line-height: 1.3;">
                  ${isResend ? 'New Password Reset Code' : 'Password Reset Verification'}
                </h2>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 32px 28px; background-color: #ffffff;">
                <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px 0; font-weight: 600; line-height: 1.5;">
                  Dear <strong>${facultyName || 'Faculty Member'}</strong>,
                </p>

                <p style="font-size: 14.5px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
                  We received a request to update the password for your MIT-WPU Rural Immersion faculty account. Please enter the following 6-digit verification code in your Settings panel:
                </p>

                <!-- 6-digit Code Box -->
                <div style="text-align: center; margin: 28px 0;">
                  <div style="display: inline-block; background-color: #ecfdf5; border: 2px dashed #059669; border-radius: 14px; padding: 18px 36px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.08);">
                    <span style="font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #064e3b; font-family: 'Courier New', Courier, monospace; display: inline-block; padding-left: 10px;">
                      ${otp}
                    </span>
                  </div>
                </div>

                <!-- Expiry Callout -->
                <div style="background-color: #f8fafc; border-left: 4px solid #047857; border-radius: 6px; padding: 14px 16px; margin-bottom: 26px;">
                  <p style="margin: 0; font-size: 13.5px; color: #475569; line-height: 1.5;">
                    ⏱️ This verification code is valid for <strong>10 minutes</strong>. For your security, never share this code with anyone.
                  </p>
                </div>

                <p style="font-size: 14px; color: #334155; margin: 0 0 6px 0; font-weight: 600;">
                  Best regards,
                </p>
                <p style="font-size: 13.5px; color: #64748b; margin: 0; line-height: 1.6;">
                  <strong style="color: #0f172a;">Rural Immersion Cell</strong><br />
                  MIT World Peace University, Pune
                </p>
              </td>
            </tr>

            <!-- Footer Area -->
            <tr>
              <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  This is an automated security notification from the MIT-WPU Rural Immersion Portal.
                </p>
                <p style="margin: 0; font-size: 11.5px; color: #cbd5e1; line-height: 1.5;">
                  If you did not request a password change, please contact the RI Admin Cell immediately.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </div>
`;

/**
 * Resolve authenticated user record from req.user
 */
const resolveAuthUser = async (req) => {
  let userId = req.user?.id;
  const userEmail = req.userEmail || req.user?.email;

  if (userId) {
    const res = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = $1', [userId]);
    if (res.rowCount > 0) return res.rows[0];
  }

  if (userEmail) {
    const res = await pool.query('SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1)', [userEmail.trim()]);
    if (res.rowCount > 0) return res.rows[0];
  }

  return null;
};

/**
 * Step 1: Request Password Reset OTP
 * POST /api/ri/faculty-portal/settings/request-password-otp
 */
const requestPasswordOtp = async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(404).json({ message: 'Faculty user record not found. Please log in again.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Your account is deactivated. Please contact RI Admin.' });
    }

    const now = new Date();

    // 1. Rate Limiting: Check 60-second cooldown
    const cooldownRes = await pool.query(
      `SELECT resend_available_at FROM password_reset_otps 
       WHERE user_id = $1 AND resend_available_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (cooldownRes.rowCount > 0) {
      const remainingSeconds = Math.ceil((new Date(cooldownRes.rows[0].resend_available_at).getTime() - now.getTime()) / 1000);
      return res.status(429).json({
        message: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
        cooldownSeconds: remainingSeconds
      });
    }

    // 2. Rate Limiting: Max 5 requests per hour
    const hourlyRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM password_reset_otps 
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [user.id]
    );

    if ((hourlyRes.rows[0]?.count || 0) >= 5) {
      return res.status(429).json({
        message: 'Maximum OTP request limit reached for this hour (5 requests). Please try again later.'
      });
    }

    // 3. Invalidate prior active OTPs
    await pool.query(
      `UPDATE password_reset_otps SET used = true WHERE user_id = $1 AND used = false`,
      [user.id]
    );

    // 4. Generate cryptographically random 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    const resendAvailableAt = new Date(now.getTime() + 60 * 1000); // 60 seconds

    // 5. Store in password_reset_otps
    await pool.query(
      `INSERT INTO password_reset_otps 
        (user_id, otp_hash, pending_password_hash, attempts_left, expires_at, resend_available_at, used)
       VALUES ($1, $2, $3, 5, $4, $5, false)`,
      [user.id, otpHash, otpHash, expiresAt, resendAvailableAt]
    );

    console.log(`[RI Faculty Settings] Generated OTP for ${maskEmail(user.email)} (User ID ${user.id})`);

    // 6. Send email dispatch
    const masked = maskEmail(user.email);
    const htmlBody = buildFacultyOtpEmailHtml(user.name, otp, false);

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Verification Code - MIT-WPU Rural Immersion',
        html: htmlBody,
        text: `Your Rural Immersion faculty password reset verification code is: ${otp}. It is valid for 10 minutes.`
      });
    } catch (emailErr) {
      console.warn(`[RI Faculty Settings] Email dispatch note for ${user.email}:`, emailErr.message);
      // In dev environment, continue so faculty can use logged console OTP
    }

    await logRiAction(pool, {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || 'Faculty',
      userRole: 'faculty',
      action: 'RI_FACULTY_PASSWORD_OTP_REQUESTED',
      details: { email: user.email, description: 'Faculty requested password reset OTP' }
    });

    return res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${masked}`,
      email: masked,
      rawEmail: user.email,
      expiresAt: expiresAt.toISOString(),
      cooldownSeconds: 60
    });
  } catch (err) {
    console.error('[RI Faculty Settings] Error in requestPasswordOtp:', err);
    return res.status(500).json({ message: 'Failed to generate verification code.', error: err.message });
  }
};

/**
 * Step 2: Resend Password Reset OTP
 * POST /api/ri/faculty-portal/settings/resend-password-otp
 */
const resendPasswordOtp = async (req, res) => {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(404).json({ message: 'Faculty user not found.' });
    }

    const now = new Date();

    // Fetch active session
    const activeRes = await pool.query(
      `SELECT id, resend_available_at, expires_at FROM password_reset_otps 
       WHERE user_id = $1 AND used = false 
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (activeRes.rowCount === 0) {
      return res.status(400).json({ message: 'No active verification session found. Please request a new code.' });
    }

    const session = activeRes.rows[0];

    // Check expiry
    if (new Date(session.expires_at) < now) {
      await pool.query('UPDATE password_reset_otps SET used = true WHERE id = $1', [session.id]);
      return res.status(400).json({ message: 'Verification session has expired. Please request a fresh code.' });
    }

    // Check cooldown
    const resendAvailableAt = new Date(session.resend_available_at);
    if (resendAvailableAt > now) {
      const remainingSeconds = Math.ceil((resendAvailableAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({
        message: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
        cooldownSeconds: remainingSeconds
      });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const newExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const newResendAvailableAt = new Date(now.getTime() + 60 * 1000);

    await pool.query(
      `UPDATE password_reset_otps 
       SET otp_hash = $1, pending_password_hash = $1, attempts_left = 5, expires_at = $2, resend_available_at = $3 
       WHERE id = $4`,
      [otpHash, newExpiresAt, newResendAvailableAt, session.id]
    );

    console.log(`[RI Faculty Settings] Resent OTP for ${maskEmail(user.email)} (User ID ${user.id})`);

    const htmlBody = buildFacultyOtpEmailHtml(user.name, otp, true);
    try {
      await sendEmail({
        to: user.email,
        subject: 'New Password Reset Code - MIT-WPU Rural Immersion',
        html: htmlBody,
        text: `Your new verification code is: ${otp}. Valid for 10 minutes.`
      });
    } catch (emailErr) {
      console.warn(`[RI Faculty Settings] Email dispatch note:`, emailErr.message);
    }

    await logRiAction(pool, {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || 'Faculty',
      userRole: 'faculty',
      action: 'RI_FACULTY_PASSWORD_OTP_RESENT',
      details: { email: user.email, description: 'Faculty resent password reset OTP' }
    });

    return res.json({
      success: true,
      message: 'A fresh verification code has been sent to your registered email.',
      expiresAt: newExpiresAt.toISOString(),
      cooldownSeconds: 60
    });
  } catch (err) {
    console.error('[RI Faculty Settings] Error in resendPasswordOtp:', err);
    return res.status(500).json({ message: 'Failed to resend verification code.', error: err.message });
  }
};

/**
 * Step 3: Verify OTP
 * POST /api/ri/faculty-portal/settings/verify-password-otp
 */
const verifyPasswordOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(404).json({ message: 'Faculty user not found.' });
    }

    const cleanOtp = String(otp || '').trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      return res.status(400).json({ message: 'Please enter a valid 6-digit verification code.' });
    }

    const now = new Date();

    const otpRes = await pool.query(
      `SELECT id, otp_hash, attempts_left, expires_at FROM password_reset_otps 
       WHERE user_id = $1 AND used = false AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (otpRes.rowCount === 0) {
      return res.status(400).json({ message: 'Verification code has expired or is invalid. Please request a new code.' });
    }

    const record = otpRes.rows[0];

    if (record.attempts_left <= 0) {
      await pool.query('UPDATE password_reset_otps SET used = true WHERE id = $1', [record.id]);
      return res.status(400).json({ message: 'Maximum verification attempts exceeded. Please request a new code.' });
    }

    const isMatch = await bcrypt.compare(cleanOtp, record.otp_hash);
    if (!isMatch) {
      const remaining = record.attempts_left - 1;
      if (remaining <= 0) {
        await pool.query('UPDATE password_reset_otps SET attempts_left = 0, used = true WHERE id = $1', [record.id]);
        return res.status(400).json({ message: 'Incorrect verification code. Maximum attempts exceeded. Please request a new code.' });
      } else {
        await pool.query('UPDATE password_reset_otps SET attempts_left = $1 WHERE id = $2', [remaining, record.id]);
        return res.status(400).json({
          message: `Incorrect verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
          attemptsLeft: remaining
        });
      }
    }

    // OTP Verified! Generate single-use resetToken valid for 15 minutes
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const tokenExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    await pool.query(
      `UPDATE password_reset_otps 
       SET reset_token_hash = $1, token_expires_at = $2, used = true, reset_used = false 
       WHERE id = $3`,
      [tokenHash, tokenExpiresAt, record.id]
    );

    await logRiAction(pool, {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || 'Faculty',
      userRole: 'faculty',
      action: 'RI_FACULTY_OTP_VERIFIED',
      details: { email: user.email, description: 'Faculty verified password reset OTP' }
    });

    return res.json({
      success: true,
      message: 'Code verified successfully. You may now create your new password.',
      resetToken
    });
  } catch (err) {
    console.error('[RI Faculty Settings] Error in verifyPasswordOtp:', err);
    return res.status(500).json({ message: 'Failed to verify OTP.', error: err.message });
  }
};

/**
 * Step 4: Set New Password
 * POST /api/ri/faculty-portal/settings/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { resetToken, otp, newPassword, confirmPassword } = req.body;
    const user = await resolveAuthUser(req);
    if (!user) {
      return res.status(404).json({ message: 'Faculty user not found.' });
    }

    // Validation
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'New password is required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirm password do not match.' });
    }

    let verifiedSessionId = null;

    if (resetToken) {
      // Validate resetToken
      const tokenHash = crypto.createHash('sha256').update(String(resetToken).trim()).digest('hex');
      const tokenRes = await pool.query(
        `SELECT id FROM password_reset_otps 
         WHERE user_id = $1 AND reset_token_hash = $2 AND token_expires_at > NOW() AND (reset_used IS NULL OR reset_used = false)
         ORDER BY created_at DESC LIMIT 1`,
        [user.id, tokenHash]
      );

      if (tokenRes.rowCount === 0) {
        return res.status(400).json({ message: 'Password reset session has expired or is invalid. Please request a new verification code.' });
      }
      verifiedSessionId = tokenRes.rows[0].id;
    } else if (otp) {
      // Direct OTP verification + reset
      const cleanOtp = String(otp).trim();
      const otpRes = await pool.query(
        `SELECT id, otp_hash, attempts_left, expires_at FROM password_reset_otps 
         WHERE user_id = $1 AND used = false AND expires_at > NOW() 
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );

      if (otpRes.rowCount === 0) {
        return res.status(400).json({ message: 'Verification code has expired or is invalid. Please request a new code.' });
      }

      const record = otpRes.rows[0];
      const isMatch = await bcrypt.compare(cleanOtp, record.otp_hash);
      if (!isMatch) {
        const remaining = record.attempts_left - 1;
        await pool.query('UPDATE password_reset_otps SET attempts_left = $1 WHERE id = $2', [Math.max(0, remaining), record.id]);
        return res.status(400).json({ message: 'Invalid verification code.' });
      }
      verifiedSessionId = record.id;
    } else {
      return res.status(400).json({ message: 'Verification code or reset authorization token is required.' });
    }

    // Hash new password securely with bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update users table
    await pool.query(
      `UPDATE users 
       SET password = $1, password_changed = true 
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    // Invalidate reset session
    if (verifiedSessionId) {
      await pool.query(
        `UPDATE password_reset_otps 
         SET reset_used = true, used = true 
         WHERE id = $1`,
        [verifiedSessionId]
      );
    }

    await logRiAction(pool, {
      userId: user.id,
      userEmail: user.email,
      userName: user.name || 'Faculty',
      userRole: 'faculty',
      action: 'RI_FACULTY_PASSWORD_CHANGED',
      details: { email: user.email, description: 'Faculty changed password' }
    });

    return res.json({
      success: true,
      message: 'Password changed successfully! You can now use your new password.'
    });
  } catch (err) {
    console.error('[RI Faculty Settings] Error in resetPassword:', err);
    return res.status(500).json({ message: 'Failed to update password.', error: err.message });
  }
};

module.exports = {
  requestPasswordOtp,
  resendPasswordOtp,
  verifyPasswordOtp,
  resetPassword,
  maskEmail
};
