const pool = require('../config/db');

/**
 * Handles incoming Resend webhook events (e.g. email.sent, email.delivered, email.bounced, email.complained).
 */
const handleResendWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    const eventType = payload.type || '';
    const eventData = payload.data || {};
    const emailId = eventData.email_id || eventData.id;

    if (!emailId) {
      return res.status(400).json({ message: 'Invalid webhook payload: email_id missing' });
    }

    let newStatus = null;
    let deliveryStatus = eventType.replace('email.', '');
    let rawProviderStatus = deliveryStatus.toUpperCase();
    let bounceReason = null;
    let errorMessage = null;

    if (eventType === 'email.delivered') {
      newStatus = 'delivered';
    } else if (eventType === 'email.suppressed') {
      newStatus = 'suppressed';
      bounceReason = eventData.bounce?.message || eventData.error?.message || 'Recipient address suppressed by provider (Resend)';
      errorMessage = bounceReason;
    } else if (eventType === 'email.bounced') {
      newStatus = 'bounced';
      bounceReason = eventData.bounce?.message || 'Bounced by recipient mail server';
      errorMessage = bounceReason;
    } else if (eventType === 'email.complained') {
      newStatus = 'bounced';
      bounceReason = 'Spam complaint registered by recipient';
      errorMessage = bounceReason;
    } else if (eventType === 'email.failed' || eventType === 'email.rejected') {
      newStatus = 'failed';
      errorMessage = eventData.error?.message || 'Resend delivery failed';
      bounceReason = errorMessage;
    } else if (eventType === 'email.sent') {
      newStatus = 'sent';
    }

    if (newStatus) {
      await pool.query(
        `UPDATE email_queue
         SET status = $1,
             delivery_status = $2,
             provider_status = $3,
             bounce_reason = COALESCE($4, bounce_reason),
             error_message = COALESCE($5, error_message),
             last_status_update = NOW(),
             updated_at = NOW()
         WHERE resend_id = $6`,
        [newStatus, deliveryStatus, rawProviderStatus, bounceReason, errorMessage, emailId]
      );
      console.log(`[Resend Webhook] Processed ${eventType} for Resend ID ${emailId} -> status: ${newStatus}, provider_status: ${rawProviderStatus}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Resend Webhook Error]:', err.message);
    return res.status(500).json({ message: 'Internal server error processing webhook' });
  }
};

module.exports = {
  handleResendWebhook,
};
