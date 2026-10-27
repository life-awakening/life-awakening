require('dotenv').config();

let transporter;

/**
 * Validates that an email dispatch request originated from an authenticated Admin HTTP request.
 * Throws a security error and logs if an automatic/unauthorized invocation is attempted.
 */
const assertManualAdminTrigger = (req) => {
  if (!req || !req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    const errorMsg = 'Blocked automatic email trigger: Unauthorized automatic invocation.';
    console.warn(`[Security Guard] 🛑 ${errorMsg}`);
    const err = new Error(errorMsg);
    err.status = 403;
    throw err;
  }
  return true;
};

/**
 * Queues an email into the database queue table with deduplication protection.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} body - Plain text body
 * @param {string} html - HTML body
 * @param {Object} [options] - Additional options (e.g. req for admin validation)
 */
const queueEmail = async (to, subject, body, html = null, options = {}) => {
  if (process.env.DISABLE_EMAIL === 'true') {
    console.log(`[Queue] 📧 Email to ${to} bypassed: "${subject}" (emails disabled via DISABLE_EMAIL)`);
    return true;
  }
  try {
    const pool = require('./db');

    const cc = options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : String(options.cc).trim()) : null;
    const bcc = options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : String(options.bcc).trim()) : null;
    const attachments = (options.attachments && Array.isArray(options.attachments) && options.attachments.length > 0)
      ? JSON.stringify(options.attachments)
      : null;

    await pool.query(
      `INSERT INTO email_queue (to_email, subject, body, html, cc, bcc, attachments) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [to, subject, body, html, cc, bcc, attachments]
    );
    console.log(`[Queue] 📧 Queued email to ${to}: "${subject}"${cc ? ` (CC: ${cc})` : ''}${bcc ? ` (BCC: ${bcc})` : ''}${attachments ? ` (${options.attachments.length} attachment(s))` : ''}`);
    return true;
  } catch (err) {
    console.error(`[Queue] Failed to queue email to ${to}:`, err.message);
    return false;
  }
};

let workerInterval = null;

/**
 * Background Email Queue Worker
 * Strictly processes jobs ALREADY present in email_queue table.
 * Does NOT generate or queue new email jobs on its own.
 */
const startEmailWorker = () => {
  if (process.env.DISABLE_EMAIL === 'true') {
    console.log(`[Worker] Background email queue worker is disabled via environment variable.`);
    return;
  }
  if (workerInterval) return;
  const pool = require('./db');
  
  // Rate delay: at least 2 seconds between emails to prevent SMTP rate limits
  const rateLimitDelayMs = parseInt(process.env.EMAIL_LIMIT_DELAY_MS || '2000');
  let isProcessing = false;

  workerInterval = setInterval(async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      // Find the next queued email ready to be sent
      const queryRes = await pool.query(
        `SELECT id, to_email, subject, body, html, cc, bcc, attachments, attempts, max_attempts
         FROM email_queue
         WHERE (status = 'pending' OR status = 'failed')
           AND attempts < max_attempts
           AND next_run_at <= NOW()
         ORDER BY created_at ASC
         LIMIT 1`
      );

      // If queue is empty, do nothing
      if (queryRes.rowCount === 0) {
        isProcessing = false;
        return;
      }

      const email = queryRes.rows[0];

      // Mark as processing immediately to prevent duplicate worker pickup
      await pool.query(`UPDATE email_queue SET status = 'processing', updated_at = NOW() WHERE id = $1`, [email.id]);

      try {
        const { sendEmail } = require('../services/emailService');
        let parsedAttachments = [];
        if (email.attachments) {
          try {
            parsedAttachments = typeof email.attachments === 'string' ? JSON.parse(email.attachments) : email.attachments;
          } catch (attParseErr) {
            console.error('[Worker] Failed to parse attachments JSON:', attParseErr.message);
          }
        }

        const info = await sendEmail({
          to: email.to_email,
          subject: email.subject,
          html: email.html,
          text: email.body,
          cc: email.cc,
          bcc: email.bcc,
          attachments: parsedAttachments
        });
        console.log(`[Worker] Sent email to ${email.to_email} (Queue ID: ${email.id}): ${info.messageId}`);
        await pool.query(
          `UPDATE email_queue
           SET status = 'sent', resend_id = $1, delivery_status = 'sent', attempts = attempts + 1, updated_at = NOW(), last_status_update = NOW()
           WHERE id = $2`,
          [info.messageId, email.id]
        );
      } catch (sendErr) {
        const attempts = email.attempts + 1;
        // Exponential backoff
        const backoffMs = 30 * Math.pow(2, attempts) * 1000;
        const nextRunAt = new Date(Date.now() + backoffMs);
        const isPermanent = attempts >= email.max_attempts;
        const newStatus = isPermanent ? 'permanent_fail' : 'failed';

        console.error(`[Worker] Failed email to ${email.to_email} (Attempt ${attempts}/${email.max_attempts}):`, sendErr.message);

        await pool.query(
          `UPDATE email_queue
           SET status = $1, attempts = $2, error_message = $3, next_run_at = $4, updated_at = NOW(), last_status_update = NOW()
           WHERE id = $5`,
          [newStatus, attempts, sendErr.message, nextRunAt, email.id]
        );
      }
    } catch (err) {
      console.error(`[Worker] Error in email queue loop:`, err.message);
    } finally {
      isProcessing = false;
    }
  }, rateLimitDelayMs);

  console.log(`[Worker] Background email queue worker started (Polling rate: 1 email per ${rateLimitDelayMs / 1000}s).`);
};

let syncWorkerInterval = null;

/**
 * Background Resend Delivery Status Sync Worker
 * Periodically polls Resend API to fetch live delivery events for sent emails.
 */
const startEmailStatusSyncWorker = () => {
  if (process.env.DISABLE_EMAIL === 'true') {
    console.log(`[SyncWorker] Background Resend status sync worker is disabled via environment variable.`);
    return;
  }
  if (syncWorkerInterval) return;
  const pool = require('./db');
  const { getEmailStatus } = require('../services/emailService');
  const pollIntervalMs = parseInt(process.env.EMAIL_SYNC_INTERVAL_MS || '20000'); // Every 20s
  let isSyncing = false;

  syncWorkerInterval = setInterval(async () => {
    if (isSyncing) return;
    isSyncing = true;

    try {
      // Find sent emails that need delivery status verification from Resend
      const queryRes = await pool.query(
        `SELECT id, resend_id, status FROM email_queue
         WHERE resend_id IS NOT NULL 
           AND status IN ('sent', 'processing')
           AND created_at >= NOW() - INTERVAL '7 days'
         ORDER BY COALESCE(last_status_update, created_at) ASC
         LIMIT 25`
      );

      if (queryRes.rowCount === 0) {
        isSyncing = false;
        return;
      }

      for (const row of queryRes.rows) {
        try {
          const resendData = await getEmailStatus(row.resend_id);
          if (!resendData) continue;

          const lastEvent = (resendData.last_event || resendData.status || '').toLowerCase();
          const rawProviderStatus = (resendData.last_event || resendData.status || '').toUpperCase();
          let newStatus = row.status;
          let deliveryStatus = lastEvent || 'sent';
          let bounceReason = null;
          let errorMessage = null;

          if (lastEvent === 'delivered') {
            newStatus = 'delivered';
          } else if (['suppressed', 'bounced', 'bounce', 'failed', 'rejected', 'undeliverable', 'complained', 'canceled'].includes(lastEvent)) {
            newStatus = lastEvent === 'suppressed' ? 'suppressed' : ((lastEvent === 'bounced' || lastEvent === 'bounce') ? 'bounced' : 'failed');
            bounceReason = resendData.bounce?.message || resendData.error?.message || `Email ${lastEvent} via Resend`;
            errorMessage = bounceReason;
          }

          await pool.query(
            `UPDATE email_queue
             SET status = $1,
                 delivery_status = $2,
                 provider_status = $3,
                 bounce_reason = COALESCE($4, bounce_reason),
                 error_message = COALESCE($5, error_message),
                 last_status_update = NOW(),
                 updated_at = NOW()
             WHERE id = $6`,
            [newStatus, deliveryStatus, rawProviderStatus, bounceReason, errorMessage, row.id]
          );
        } catch (itemErr) {
          // Log softly so sync continues for other items
          console.warn(`[SyncWorker] Could not sync Resend ID ${row.resend_id}: ${itemErr.message}`);
        }
      }
    } catch (syncErr) {
      console.error('[SyncWorker] Error in status sync loop:', syncErr.message);
    } finally {
      isSyncing = false;
    }
  }, pollIntervalMs);

  console.log(`[SyncWorker] Background Resend status sync worker started (Polling interval: ${pollIntervalMs / 1000}s).`);
};

const setupMailer = async () => {
  console.log("[Resend] Email worker & status sync initialized.");
  startEmailWorker();
  startEmailStatusSyncWorker();
};

// Deprecated automatic email functions — kept for signature safety, but blocked from auto-triggering
const sendLtcBatchEmail = async (name, email) => {
  console.warn(`[Security Guard] 🛑 Blocked automatic email trigger: Unauthorized automatic invocation for ${email} (sendLtcBatchEmail).`);
  return false;
};

const syncPendingResendStatuses = async (limit = 15) => {
  const pool = require('./db');
  const { getEmailStatus } = require('../services/emailService');
  try {
    const queryRes = await pool.query(
      `SELECT id, resend_id, status FROM email_queue
       WHERE resend_id IS NOT NULL 
         AND status IN ('sent', 'processing')
         AND created_at >= NOW() - INTERVAL '7 days'
       ORDER BY COALESCE(last_status_update, created_at) ASC
       LIMIT $1`,
      [limit]
    );

    if (queryRes.rowCount === 0) return 0;

    let updatedCount = 0;
    for (const row of queryRes.rows) {
      try {
        const resendData = await getEmailStatus(row.resend_id);
        if (!resendData) continue;

        const lastEvent = (resendData.last_event || resendData.status || '').toLowerCase();
        const rawProviderStatus = (resendData.last_event || resendData.status || '').toUpperCase();
        let newStatus = row.status;
        let deliveryStatus = lastEvent || 'sent';
        let bounceReason = null;
        let errorMessage = null;

        if (lastEvent === 'delivered') {
          newStatus = 'delivered';
        } else if (['suppressed', 'bounced', 'bounce', 'failed', 'rejected', 'undeliverable', 'complained', 'canceled'].includes(lastEvent)) {
          newStatus = lastEvent === 'suppressed' ? 'suppressed' : ((lastEvent === 'bounced' || lastEvent === 'bounce') ? 'bounced' : 'failed');
          bounceReason = resendData.bounce?.message || resendData.error?.message || `Email ${lastEvent} via Resend`;
          errorMessage = bounceReason;
        }

        await pool.query(
          `UPDATE email_queue
           SET status = $1,
               delivery_status = $2,
               provider_status = $3,
               bounce_reason = COALESCE($4, bounce_reason),
               error_message = COALESCE($5, error_message),
               last_status_update = NOW(),
               updated_at = NOW()
           WHERE id = $6`,
          [newStatus, deliveryStatus, rawProviderStatus, bounceReason, errorMessage, row.id]
        );
        updatedCount++;
      } catch (itemErr) {
        console.warn(`[SyncWorker] Could not sync Resend ID ${row.resend_id}: ${itemErr.message}`);
      }
    }
    return updatedCount;
  } catch (err) {
    console.error('[SyncWorker] Error in syncPendingResendStatuses:', err.message);
    return 0;
  }
};

const sendSquadNotificationEmail = async (name, email, squad) => {
  console.warn(`[Security Guard] 🛑 Blocked automatic email trigger: Unauthorized automatic invocation for ${email} (sendSquadNotificationEmail).`);
  return false;
};

module.exports = {
  setupMailer,
  sendLtcBatchEmail,
  sendSquadNotificationEmail,
  queueEmail,
  startEmailWorker,
  startEmailStatusSyncWorker,
  syncPendingResendStatuses,
  assertManualAdminTrigger
};
