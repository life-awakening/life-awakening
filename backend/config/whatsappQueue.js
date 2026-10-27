require('dotenv').config();
const pool = require('./db');

/**
 * Inserts a message into the WhatsApp dispatch queue table.
 * 
 * @param {string} toPhone - Recipient phone number
 * @param {string} body - Compiled text message content
 * @returns {Promise<boolean>}
 */
const queueWhatsapp = async (toPhone, body) => {
  try {
    await pool.query(
      `INSERT INTO whatsapp_queue (to_phone, body) VALUES ($1, $2)`,
      [toPhone, body]
    );
    console.log(`[Queue] 📱 Queued WhatsApp to ${toPhone}: "${body.substring(0, 50)}..."`);
    return true;
  } catch (err) {
    console.error(`[Queue] Failed to queue WhatsApp to ${toPhone}:`, err.message);
    return false;
  }
};

/**
 * Helper to update campaign completion status
 */
const checkCampaignCompletion = async (campaignId) => {
  try {
    const res = await pool.query(
      `SELECT total_count, sent_count, failed_count FROM whatsapp_campaigns WHERE id = $1`,
      [campaignId]
    );
    if (res.rowCount > 0) {
      const { total_count, sent_count, failed_count } = res.rows[0];
      if (sent_count + failed_count >= total_count) {
        await pool.query(
          `UPDATE whatsapp_campaigns SET status = 'completed', updated_at = NOW() WHERE id = $1`,
          [campaignId]
        );
        console.log(`[Worker] WhatsApp Campaign ${campaignId} completed! Total: ${total_count}, Sent: ${sent_count}, Failed: ${failed_count}`);
      } else {
        await pool.query(
          `UPDATE whatsapp_campaigns SET status = 'processing', updated_at = NOW() WHERE id = $1`,
          [campaignId]
        );
      }
    }
  } catch (err) {
    console.error(`Error checking campaign completion for ${campaignId}:`, err.message);
  }
};

let workerInterval = null;

/**
 * Background Poller Worker for WhatsApp Dispatch Queue.
 * Polls database and processes pending/failed records sequentially.
 */
const startWhatsappWorker = () => {
  if (workerInterval) return;
  
  // Custom rate-limiting delay between dispatches (default 2s to avoid API rate limits)
  const rateLimitDelayMs = parseInt(process.env.WHATSAPP_LIMIT_DELAY_MS || '2000');
  let isProcessing = false;

  workerInterval = setInterval(async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      // Fetch the next message that requires sending (templates support added)
      const res = await pool.query(
        `SELECT id, to_phone, body, attempts, max_attempts, campaign_id, student_id, template_name, template_variables, media_id
         FROM whatsapp_queue
         WHERE (status = 'pending' OR status = 'failed' OR (status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes'))
           AND attempts < max_attempts
           AND next_run_at <= NOW()
         ORDER BY created_at ASC
         LIMIT 1`
      );

      if (res.rowCount === 0) {
        isProcessing = false;
        return;
      }

      const item = res.rows[0];

      // Mark status as processing to prevent other concurrent pollers from picking it up
      await pool.query(
        `UPDATE whatsapp_queue SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [item.id]
      );

      try {
        let info;
        if (item.template_name) {
          const { sendWhatsappTemplate } = require('../services/whatsappService');
          
          let tplVars = {};
          if (item.template_variables) {
            tplVars = typeof item.template_variables === 'string' 
              ? JSON.parse(item.template_variables) 
              : item.template_variables;
          }

          const bodyParams = tplVars.bodyParams || [];
          const buttonParam = tplVars.buttonParam || null;

          info = await sendWhatsappTemplate({
            to: item.to_phone,
            templateName: item.template_name,
            headerImageId: item.media_id,
            bodyParameters: bodyParams,
            buttonParameter: buttonParam
          });
        } else {
          const { sendWhatsapp } = require('../services/whatsappService');
          info = await sendWhatsapp({ to: item.to_phone, body: item.body });
        }
        
        await pool.query(
          `UPDATE whatsapp_queue 
           SET status = 'sent', attempts = attempts + 1, error_message = NULL, meta_message_id = $1, updated_at = NOW() 
           WHERE id = $2`,
          [info.messageId, item.id]
        );

        if (item.campaign_id) {
          await pool.query(
            `UPDATE whatsapp_campaigns 
             SET sent_count = sent_count + 1, updated_at = NOW() 
             WHERE id = $1`,
            [item.campaign_id]
          );
        }

        await pool.query(
          `INSERT INTO whatsapp_campaign_logs (campaign_id, student_id, phone, status, meta_message_id, template_name, sent_at)
           VALUES ($1, $2, $3, 'sent', $4, $5, NOW())`,
          [item.campaign_id || null, item.student_id || null, item.to_phone, info.messageId, item.template_name || 'ltc_notification']
        );

        if (item.campaign_id) {
          await checkCampaignCompletion(item.campaign_id);
        }

        console.log(`[Worker] WhatsApp message delivered successfully to ${item.to_phone} (Queue ID: ${item.id}). API ID: ${info.messageId}`);
      } catch (sendErr) {
        const errMsg = sendErr.message || '';
        const isNonTransientMetaError = errMsg.includes('132005') || 
                                       errMsg.includes('too long') || 
                                       errMsg.includes('400') || 
                                       errMsg.includes('OAuthException') || 
                                       errMsg.includes('invalid') || 
                                       errMsg.includes('template');
        const nextAttempts = item.attempts + 1;
        const isPermanent = nextAttempts >= item.max_attempts || isNonTransientMetaError;
        const newStatus = isPermanent ? 'permanent_fail' : 'failed';
        const backoffSec = 30 * Math.pow(2, nextAttempts);
        const nextRunAt = new Date(Date.now() + backoffSec * 1000);

        console.error(`[Worker] WhatsApp dispatch failed for ${item.to_phone} (Attempt ${nextAttempts}/${item.max_attempts}, Permanent: ${isPermanent}):`, sendErr.message);

        await pool.query(
          `UPDATE whatsapp_queue
           SET status = $1, attempts = $2, error_message = $3, next_run_at = $4, updated_at = NOW()
           WHERE id = $5`,
          [newStatus, nextAttempts, sendErr.message, nextRunAt, item.id]
        );

        if (isPermanent) {
          await pool.query(
            `INSERT INTO whatsapp_campaign_logs (campaign_id, student_id, phone, status, error_message, template_name, sent_at)
             VALUES ($1, $2, $3, 'failed', $4, $5, NOW())`,
            [item.campaign_id || null, item.student_id || null, item.to_phone, sendErr.message, item.template_name || 'ltc_notification']
          );

          if (item.campaign_id) {
            await pool.query(
              `UPDATE whatsapp_campaigns 
               SET failed_count = failed_count + 1, updated_at = NOW() 
               WHERE id = $1`,
              [item.campaign_id]
            );

            await checkCampaignCompletion(item.campaign_id);
          }
        }
      }
    } catch (err) {
      console.error(`[Worker] Exception in WhatsApp Queue Poller loop:`, err.message);
    } finally {
      isProcessing = false;
    }
  }, rateLimitDelayMs);

  console.log(`[Worker] Background WhatsApp Queue Worker started (Polling interval: ${rateLimitDelayMs / 1000}s).`);
};

const setupWhatsAppQueue = async () => {
  console.log('[WhatsApp] Background queue worker initialized.');
  startWhatsappWorker();
};

module.exports = {
  setupWhatsAppQueue,
  queueWhatsapp,
  startWhatsappWorker
};
