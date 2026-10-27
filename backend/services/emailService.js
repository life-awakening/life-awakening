require('dotenv').config();
const { Resend } = require('resend');

/**
 * Gets and validates the current Resend API Key from process.env.
 * Trims any accidental whitespace.
 * @returns {string}
 */
const getApiKey = () => {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key) {
    console.error('[Resend] FATAL: RESEND_API_KEY is not set in environment.');
  }
  return key;
};

const cleanEnv = (val, fallback = '') => {
  const str = (val !== undefined && val !== null ? String(val) : fallback).trim();
  return str.replace(/^["']|["']$/g, '').trim();
};

// Rate-limiting delay state to respect EMAIL_LIMIT_DELAY_MS
let lastSendPromise = Promise.resolve();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const scheduleSendDelay = () => {
  const delayMs = parseInt(process.env.EMAIL_LIMIT_DELAY_MS, 10) || 0;
  if (delayMs <= 0) return Promise.resolve();

  const nextWait = lastSendPromise.then(async () => {
    await sleep(delayMs);
  });
  lastSendPromise = nextWait;
  return nextWait;
};

/**
 * Sends an email using Resend.
 *
 * @param {Object} options
 * @param {string} options.to            - Recipient email address
 * @param {string} options.subject       - Email subject
 * @param {string} options.html          - HTML body
 * @param {string} [options.text]        - Plain text fallback (optional)
 * @param {string|string[]} [options.cc] - Carbon copy recipient(s)
 * @param {string|string[]} [options.bcc]- Blind carbon copy recipient(s)
 * @param {Array} [options.attachments]  - Array of attachment objects
 * @returns {Promise<{ messageId: string }>}
 */
const sendEmail = async ({ to, subject, html, text, cc, bcc, attachments }) => {
  const apiKey = getApiKey();
  const fromEmail = cleanEnv(process.env.RESEND_FROM_EMAIL, 'Life Awakening Program <no-reply@lifeawakening.in>');
  const replyTo = cleanEnv(process.env.RESEND_REPLY_TO, 'contact@lifeawakening.in');

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing. Check your backend .env file.');
  }

  // Safe masked debug log
  const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : '***';
  console.log(`[Resend] Initiating email send to ${to} using API Key [${maskedKey}]`);

  const resend = new Resend(apiKey);

  const payload = {
    from: fromEmail,
    to: [to],
    subject,
    html,
    reply_to: replyTo,
  };

  if (text) {
    payload.text = text;
  }

  // CC recipients support
  if (cc) {
    const ccList = (Array.isArray(cc) ? cc : String(cc).split(/[\s,;]+/))
      .map(e => String(e).trim())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (ccList.length > 0) {
      payload.cc = ccList;
    }
  }

  // BCC recipients support
  if (bcc) {
    const bccList = (Array.isArray(bcc) ? bcc : String(bcc).split(/[\s,;]+/))
      .map(e => String(e).trim())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bccList.length > 0) {
      payload.bcc = bccList;
    }
  }

  // Attachments support
  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    payload.attachments = attachments.map(att => {
      const item = {
        filename: att.filename || 'attachment'
      };
      if (att.content) {
        item.content = Buffer.isBuffer(att.content)
          ? att.content
          : Buffer.from(String(att.content).replace(/^data:[^;]+;base64,/, ''), 'base64');
      } else if (att.path) {
        item.path = att.path;
      }
      return item;
    });
  }

  const maxAttempts = 2;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Respect configured sending delay before calling Resend API
      await scheduleSendDelay();

      const { data, error } = await resend.emails.send(payload);

      if (error) {
        const isTemporary = error.statusCode === 429 || (error.statusCode >= 500 && error.statusCode < 600);
        if (isTemporary && attempt < maxAttempts) {
          console.warn(`[Resend] Temporary error sending to ${to} (${error.message}). Retrying in 2s (attempt ${attempt}/${maxAttempts})...`);
          await sleep(2000);
          continue;
        }
        console.error(`[Resend] API error sending to ${to}:`, error.message || error);
        throw new Error(error.message || 'Resend API returned an error');
      }

      if (!data || !data.id) {
        throw new Error('Resend did not return a valid message ID');
      }

      console.log(`[Resend] Email sent successfully to ${to}. ID: ${data.id}`);
      return { messageId: data.id };
    } catch (error) {
      const safeMessage = (error.message || 'Unknown error').replace(apiKey, '[REDACTED]');
      if (attempt >= maxAttempts) {
        console.error(`[Resend] Failed to send email to ${to}: ${safeMessage}`);
        throw new Error(safeMessage);
      }
      console.warn(`[Resend] Retrying after error for ${to}: ${safeMessage}`);
      await sleep(2000);
    }
  }
};

/**
 * Retrieves delivery status details for a specific email from Resend API.
 * @param {string} resendId - Resend email ID
 * @returns {Promise<Object>}
 */
const getEmailStatus = async (resendId) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing. Check your backend .env file.');
  }

  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.get(resendId);
    if (error) {
      console.error(`[Resend] API error fetching status for ID ${resendId}:`, error);
      throw new Error(error.message || 'Resend API error fetching status');
    }
    return data;
  } catch (error) {
    const safeMessage = (error.message || 'Unknown error').replace(apiKey, '[REDACTED]');
    console.error(`[Resend] Failed to fetch email status for ${resendId}: ${safeMessage}`);
    throw new Error(safeMessage);
  }
};

module.exports = {
  sendEmail,
  getEmailStatus,
};
