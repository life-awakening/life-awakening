const pool = require('../config/db');
const emailService = require('../services/emailService');
const { logRiAction } = require('../utils/riAudit');

// ── RI Email Templates Configuration ──────────────────────────────────────────
const RI_EMAIL_TEMPLATES = {
  welcome: {
    id: 'welcome',
    name: 'Welcome & Portal Access',
    description: 'Welcome students/faculty to RI with portal login details and instructions.',
    defaultSubject: 'Welcome to Rural Immersion Program - Batch {{batch_name}}',
    defaultBody: `Dear {{name}},

Welcome to the Rural Immersion Program for {{batch_name}}.

Rural Immersion is a transformative experiential learning curriculum organized by the School of Government at MIT World Peace University. You have been assigned to Panel {{panel}}, allocated to Village {{village}}.

Program Schedule:
• Start Date: {{start_date}}
• End Date: {{end_date}}
• Student ID / Code: {{ri_id}}

To access your student portal, view your village assignments, complete the pre-departure checklist, and review essential guidelines, please log in below:
{{login_url}}

Please ensure you review all instructions and submit the required undertakings prior to departure.

Warm regards,
Rural Immersion Administration
MIT World Peace University, Pune`
  },

  travel: {
    id: 'travel',
    name: 'Travel & Departure Information',
    description: 'Provide departure timings, reporting location, bus allocations, and travel guidelines.',
    defaultSubject: 'Rural Immersion Travel & Departure Details - Batch {{batch_name}}',
    defaultBody: `Dear {{name}},

This is an important update regarding travel and departure for your upcoming Rural Immersion journey for {{batch_name}}.

Reporting & Departure Details:
• Reporting Venue: MIT-WPU Kothrud Campus (Bus Bay Area)
• Departure Date: {{start_date}}
• Allocated Village: {{village}}
• Panel: {{panel}}

Key Travel Instructions:
• Please report promptly at the assigned assembly point 45 minutes before departure.
• Keep your university ID card and government photo identification accessible.
• Carry minimal luggage (one duffel/backpack and one personal kit).
• Review the Things to Carry checklist on your student portal: {{login_url}}

If you have any emergency queries, contact your designated Faculty Mentor or Nodal Officer immediately.

Best regards,
Travel & Logistics Desk, Rural Immersion
MIT-WPU Pune`
  },

  instructions: {
    id: 'instructions',
    name: 'Pre-Departure Instructions & Guidelines',
    description: 'Field conduct, safety guidelines, things to carry, and village study rules.',
    defaultSubject: 'Rural Immersion Pre-Departure Guidelines & Protocols - Batch {{batch_name}}',
    defaultBody: `Dear {{name}},

As you prepare for the Rural Immersion Program in {{village}}, please carefully read and adhere to the following field study guidelines:

Field Conduct & Safety:
• Respect the cultural traditions and social norms of the village community.
• Maintain professional decorum during interactions with villagers, Sarpanch, and local leaders.
• Follow all instructions given by your Faculty Mentor and local coordinator.
• Adhere to village curfew timings and never leave your designated village area alone.
• Strictly maintain field diaries and complete daily activity documentation.

Access your portal to verify readiness and complete all preparatory verifications:
{{login_url}}

Rural Immersion Academic Committee
MIT World Peace University`
  },

  reminders: {
    id: 'reminders',
    name: 'Readiness & Document Reminders',
    description: 'Urgent reminder to complete preparatory checklists, undertakings, and forms.',
    defaultSubject: 'Urgent Reminder: Complete Rural Immersion Verifications - Batch {{batch_name}}',
    defaultBody: `Dear {{name}},

This is a reminder that the Rural Immersion program for {{batch_name}} commences on {{start_date}}.

Our records indicate that you may still have pending items on your preparatory checklist. Please complete the following as soon as possible:
1. Sign and submit your Student Undertaking Form.
2. Verify emergency contact details and medical information.
3. Complete the Pre-Departure Readiness Checklist on the student portal.

Portal Link:
{{login_url}}

Failure to submit mandatory undertakings may lead to withholding of field departure clearance.

Regards,
RI Administrative Office
MIT-WPU Pune`
  },

  announcement: {
    id: 'announcement',
    name: 'RI Announcement',
    description: 'Customizable announcement for special briefings, schedules, or updates.',
    defaultSubject: 'Important Announcement: Rural Immersion Program - Batch {{batch_name}}',
    defaultBody: `Dear {{name}},

We would like to share an important announcement regarding your Rural Immersion Program for {{batch_name}} (Village: {{village}}).

[Enter announcement details here]

Please log in to your portal for further information and updates:
{{login_url}}

Sincerely,
Rural Immersion Program Office
MIT World Peace University`
  }
};

// ── HTML Formatting Helpers ───────────────────────────────────────────────────
const formatEmailBodyToHtml = (text) => {
  if (!text) return '';

  let clean = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*["']?\s*javascript:[^"'>]*["']?/gi, 'href="#"');

  const blocks = clean.split(/(<(?:div|table)[\s\S]*?<\/(?:div|table)>)/gi);

  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    if (/^<(?:div|table)[\s\S]*/i.test(trimmed)) {
      return trimmed;
    }

    const paragraphs = trimmed.split(/\n\s*\n/);
    return paragraphs.map(p => {
      const pTrimmed = p.trim();
      if (!pTrimmed) return '';

      const lines = pTrimmed.split('\n');
      const formattedLines = lines.map((line, idx) => {
        if (idx === lines.length - 1) return line;
        const lTrim = line.trim();
        if (/<br\s*\/?>$/i.test(lTrim) || /<\/(?:p|div|h[1-6]|li|tr|table|ul|ol)>$/i.test(lTrim)) {
          return line;
        }
        return line + '<br/>';
      }).join('\n');

      if (/^<(?:p|h[1-6]|ul|ol|blockquote|div|table)/i.test(pTrimmed)) {
        return formattedLines;
      }

      return `<p style="margin: 0 0 12px 0; font-size: 14.5px; color: #334155; line-height: 1.6;">${formattedLines}</p>`;
    }).filter(Boolean).join('\n');
  });

  return formattedBlocks.filter(Boolean).join('\n');
};

const buildBrandedRiEmailHtml = (subject, bodyHtml) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Branded Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #a7f3d0; margin-bottom: 6px;">
                MIT WORLD PEACE UNIVERSITY
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; line-height: 1.3; text-transform: uppercase;">
                RURAL IMMERSION PROGRAM
              </h1>
              <div style="font-size: 14px; font-weight: 600; color: #d1fae5; letter-spacing: 0.3px;">
                Official Communication Desk
              </div>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5;">
              This is an official communication from <strong>Rural Immersion Administration</strong>.<br/>
              School of Government & MIT World Peace University, Pune.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ── Email Extractor ──────────────────────────────────────────────────────────
const extractCleanEmailList = (input) => {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : String(input).split(/[\s,;\t\r\n]+/);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    const trimmed = String(item).trim().toLowerCase();
    if (trimmed && emailRegex.test(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
};

// ── Controller Methods ────────────────────────────────────────────────────────

/**
 * 1. Get RI-ONLY Batches (Strictly excludes LTC-synced batches)
 * Used by the batch dropdown in RI Sender Console.
 */
const getRiBatchesForCommunication = async (req, res) => {
  try {
    const query = `
      SELECT 
        rb.id,
        rb.name,
        COALESCE(rb.batch_code, '') AS batch_code,
        rb.start_date,
        rb.end_date,
        rb.status,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_batch_id = rb.id) AS total_students,
        (SELECT COUNT(*)::int FROM ri_batch_faculty rbf WHERE rbf.ri_batch_id = rb.id AND rbf.status <> 'deleted') AS total_faculty,
        (SELECT COUNT(*)::int FROM ri_panels rp WHERE rp.ri_batch_id = rb.id) AS total_panels,
        (SELECT COUNT(*)::int FROM ri_villages rv WHERE rv.ri_batch_id = rb.id AND rv.status <> 'deleted') AS total_villages
      FROM ri_batches rb
      WHERE (rb.source_batch_id IS NULL)
        AND (rb.source_program IN ('RI', 'RI_DIRECT') OR rb.source_program IS NULL)
        AND (rb.source_program NOT IN ('LTC', 'LTC_SYNC'))
        AND (rb.status <> 'deleted')
      ORDER BY rb.created_at DESC, rb.id DESC
    `;

    const result = await pool.query(query);
    return res.json({
      success: true,
      batches: result.rows,
      templates: RI_EMAIL_TEMPLATES
    });
  } catch (err) {
    console.error('[RI Communication] Error fetching RI-only batches:', err);
    return res.status(500).json({ message: 'Failed to fetch RI batches', error: err.message });
  }
};

/**
 * 2. Get Eligible Recipients for an RI-only Batch
 * Strictly rejects LTC-synced batches.
 */
const getRiBatchRecipients = async (req, res) => {
  try {
    const batchId = parseInt(req.query.batch_id || req.params.batchId, 10);
    if (!batchId) {
      return res.status(400).json({ message: 'Valid RI batch ID is required.' });
    }

    // Verify batch is RI-only
    const batchCheck = await pool.query(
      `SELECT id, name, source_program, source_batch_id, start_date, end_date
       FROM ri_batches
       WHERE id = $1 AND status <> 'deleted'`,
      [batchId]
    );

    if (batchCheck.rowCount === 0) {
      return res.status(404).json({ message: 'RI batch not found.' });
    }

    const batch = batchCheck.rows[0];
    if (batch.source_batch_id !== null || ['LTC', 'LTC_SYNC'].includes(batch.source_program)) {
      return res.status(403).json({
        message: 'Security Violation: Selected batch is LTC-synced. Communication is restricted strictly to RI-direct batches.'
      });
    }

    // Fetch students
    const studentsRes = await pool.query(`
      SELECT 
        u.id AS user_id,
        u.name,
        u.email,
        'student' AS role,
        u.parent_email,
        u.parent_mobile,
        rbs.ri_id,
        rp.name AS panel_name,
        rv.name AS village_name,
        rb.name AS batch_name,
        rb.start_date::text AS start_date,
        rb.end_date::text AS end_date
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rbs.ri_batch_id = $1
      ORDER BY u.name ASC
    `, [batchId]);

    // Fetch faculty
    const facultyRes = await pool.query(`
      SELECT 
        COALESCE(u.id, rbf.id) AS user_id,
        rbf.name,
        rbf.email,
        'faculty' AS role,
        NULL AS parent_email,
        NULL AS parent_mobile,
        NULL AS ri_id,
        rp.name AS panel_name,
        rv.name AS village_name,
        rb.name AS batch_name,
        rb.start_date::text AS start_date,
        rb.end_date::text AS end_date
      FROM ri_batch_faculty rbf
      JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
      LEFT JOIN users u ON LOWER(u.email) = LOWER(rbf.email)
      LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rbf.ri_batch_id = $1 AND rbf.status <> 'deleted'
      ORDER BY rbf.name ASC
    `, [batchId]);

    // Format recipients
    const students = studentsRes.rows;
    const faculty = facultyRes.rows;
    const parents = students
      .filter(s => s.parent_email && s.parent_email.trim())
      .map(s => ({
        user_id: s.user_id,
        name: `Parent of ${s.name}`,
        email: s.parent_email.trim(),
        role: 'parent',
        student_name: s.name,
        ri_id: s.ri_id,
        panel_name: s.panel_name,
        village_name: s.village_name,
        batch_name: s.batch_name,
        start_date: s.start_date,
        end_date: s.end_date
      }));

    return res.json({
      success: true,
      batch: {
        id: batch.id,
        name: batch.name,
        start_date: batch.start_date,
        end_date: batch.end_date
      },
      counts: {
        total_unique: students.length + faculty.length,
        students: students.length,
        faculty: faculty.length,
        parents: parents.length
      },
      recipients: {
        students,
        faculty,
        parents
      }
    });
  } catch (err) {
    console.error('[RI Communication] Error fetching recipients:', err);
    return res.status(500).json({ message: 'Failed to fetch recipients', error: err.message });
  }
};

/**
 * 3. Send RI Communication Emails (Batch or Manual)
 * Supports dryRun/mock testing to guarantee zero real emails sent during verification.
 */
const sendRiEmail = async (req, res) => {
  try {
    const {
      batchId,
      targetRoles = ['student', 'faculty'],
      manualEmails = '',
      subject,
      body,
      templateKey = 'custom',
      extraFieldValues = {},
      dryRun = false
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: 'Subject is required.' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ message: 'Message body is required.' });
    }

    let recipientsToSend = [];
    let batchInfo = null;

    // Mode A: Manual Email Entry
    if (manualEmails && manualEmails.trim()) {
      const cleanList = extractCleanEmailList(manualEmails);
      if (cleanList.length === 0) {
        return res.status(400).json({ message: 'No valid recipient email addresses found in manual input.' });
      }

      recipientsToSend = cleanList.map(email => ({
        email,
        name: email.split('@')[0],
        role: 'manual',
        ri_id: 'N/A',
        panel_name: 'Direct Recipient',
        village_name: 'N/A',
        batch_name: 'Direct Dispatch',
        start_date: extraFieldValues.start_date || 'N/A',
        end_date: extraFieldValues.end_date || 'N/A'
      }));
    } else {
      // Mode B: Batch-Based Send
      if (!batchId) {
        return res.status(400).json({ message: 'Either select a target batch or enter manual recipient emails.' });
      }

      // Check batch is strictly RI-only
      const batchCheck = await pool.query(
        `SELECT id, name, source_program, source_batch_id, start_date, end_date
         FROM ri_batches
         WHERE id = $1 AND status <> 'deleted'`,
        [batchId]
      );

      if (batchCheck.rowCount === 0) {
        return res.status(404).json({ message: 'RI batch not found.' });
      }

      batchInfo = batchCheck.rows[0];
      if (batchInfo.source_batch_id !== null || ['LTC', 'LTC_SYNC'].includes(batchInfo.source_program)) {
        return res.status(403).json({
          message: 'Security Violation: Selected batch is LTC-synced. Communication is restricted strictly to RI-direct batches.'
        });
      }

      // Collect recipients according to targetRoles
      const roles = Array.isArray(targetRoles) ? targetRoles : [targetRoles];
      const queries = [];
      const params = [batchId];

      if (roles.includes('student')) {
        queries.push(`
          SELECT 
            u.id AS student_id,
            u.name,
            u.email,
            'student' AS role,
            rbs.ri_id,
            rp.name AS panel_name,
            rv.name AS village_name,
            rb.name AS batch_name,
            rb.start_date::text AS start_date,
            rb.end_date::text AS end_date
          FROM ri_batch_students rbs
          JOIN users u ON rbs.student_id = u.id
          JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
          LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
          LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
          WHERE rbs.ri_batch_id = $1
        `);
      }

      if (roles.includes('faculty')) {
        queries.push(`
          SELECT 
            COALESCE(u.id, rbf.id) AS student_id,
            rbf.name,
            rbf.email,
            'faculty' AS role,
            NULL AS ri_id,
            rp.name AS panel_name,
            rv.name AS village_name,
            rb.name AS batch_name,
            rb.start_date::text AS start_date,
            rb.end_date::text AS end_date
          FROM ri_batch_faculty rbf
          JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
          LEFT JOIN users u ON LOWER(u.email) = LOWER(rbf.email)
          LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
          LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
          WHERE rbf.ri_batch_id = $1 AND rbf.status <> 'deleted'
        `);
      }

      if (roles.includes('parent')) {
        queries.push(`
          SELECT 
            u.id AS student_id,
            CONCAT('Parent of ', u.name) AS name,
            u.parent_email AS email,
            'parent' AS role,
            rbs.ri_id,
            rp.name AS panel_name,
            rv.name AS village_name,
            rb.name AS batch_name,
            rb.start_date::text AS start_date,
            rb.end_date::text AS end_date
          FROM ri_batch_students rbs
          JOIN users u ON rbs.student_id = u.id
          JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
          LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
          LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
          WHERE rbs.ri_batch_id = $1 AND u.parent_email IS NOT NULL AND TRIM(u.parent_email) != ''
        `);
      }

      if (queries.length === 0) {
        return res.status(400).json({ message: 'Please select at least one recipient role (Student, Faculty, or Parent).' });
      }

      const unifiedQuery = queries.join(' UNION ALL ');
      const dbRecipientsRes = await pool.query(unifiedQuery, params);
      recipientsToSend = dbRecipientsRes.rows;
    }

    if (recipientsToSend.length === 0) {
      return res.status(400).json({ message: 'No recipients found for the selected criteria.' });
    }

    // Deduplicate recipients by email to prevent duplicate sends
    const seenEmails = new Set();
    const uniqueRecipients = [];
    for (const r of recipientsToSend) {
      const email = (r.email || '').trim().toLowerCase();
      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        uniqueRecipients.push({ ...r, email });
      }
    }

    const portalLoginUrl = process.env.PORTAL_LOGIN_URL || (req.get('host') ? `${req.protocol}://${req.get('host')}/login` : 'http://13.207.119.57/login');
    const isMock = dryRun === true || process.env.DISABLE_EMAIL === 'true' || process.env.NODE_ENV === 'test';

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    // Verify authenticated user ID exists to safely satisfy foreign key constraint
    let safeUserId = req.user?.id || null;
    if (safeUserId) {
      const uCheck = await pool.query('SELECT id FROM users WHERE id = $1', [safeUserId]);
      if (uCheck.rowCount === 0) safeUserId = null;
    }

    for (const r of uniqueRecipients) {
      const startDateStr = r.start_date ? new Date(r.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD';
      const endDateStr = r.end_date ? new Date(r.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD';
      const roleDisplayName = r.role === 'student' ? 'Student' : (r.role === 'faculty' ? 'Faculty Mentor' : (r.role === 'parent' ? 'Parent' : 'Participant'));

      // Variable interpolation
      let personalizedSubj = subject
        .replace(/{{name}}/g, r.name || '')
        .replace(/{{role}}/g, roleDisplayName)
        .replace(/{{batch_name}}/g, r.batch_name || batchInfo?.name || '')
        .replace(/{{village}}/g, r.village_name || 'Assigned Village')
        .replace(/{{panel}}/g, r.panel_name || 'Assigned Panel')
        .replace(/{{ri_id}}/g, r.ri_id || 'N/A')
        .replace(/{{email}}/g, r.email || '')
        .replace(/{{start_date}}/g, startDateStr)
        .replace(/{{end_date}}/g, endDateStr)
        .replace(/{{login_url}}/g, portalLoginUrl);

      let personalizedBody = body
        .replace(/{{name}}/g, r.name || '')
        .replace(/{{role}}/g, roleDisplayName)
        .replace(/{{batch_name}}/g, r.batch_name || batchInfo?.name || '')
        .replace(/{{village}}/g, r.village_name || 'Assigned Village')
        .replace(/{{panel}}/g, r.panel_name || 'Assigned Panel')
        .replace(/{{ri_id}}/g, r.ri_id || 'N/A')
        .replace(/{{email}}/g, r.email || '')
        .replace(/{{start_date}}/g, startDateStr)
        .replace(/{{end_date}}/g, endDateStr)
        .replace(/{{login_url}}/g, portalLoginUrl);

      // Custom extra field values replacement
      if (extraFieldValues && typeof extraFieldValues === 'object') {
        for (const [k, v] of Object.entries(extraFieldValues)) {
          if (v !== undefined && v !== null) {
            const reg = new RegExp(`{{${k}}}`, 'g');
            personalizedSubj = personalizedSubj.replace(reg, String(v));
            personalizedBody = personalizedBody.replace(reg, String(v));
          }
        }
      }

      const formattedBodyHtml = formatEmailBodyToHtml(personalizedBody);
      const brandedHtml = buildBrandedRiEmailHtml(personalizedSubj, formattedBodyHtml);

      try {
        let resendId = null;

        if (isMock) {
          // Simulation / dry-run safe send
          resendId = `sim_resend_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        } else {
          // Live send through existing emailService using configured Resend API key
          const sendRes = await emailService.sendEmail({
            to: r.email,
            subject: personalizedSubj,
            html: brandedHtml,
            text: personalizedBody
          });
          resendId = sendRes?.messageId || null;
        }

        sentCount++;
        results.push({
          email: r.email,
          name: r.name,
          role: r.role,
          status: 'sent',
          resend_id: resendId
        });

        // Log audit event into ri_audit_logs
        await logRiAction(pool, {
          userId: safeUserId,
          userEmail: req.user?.email,
          userName: req.user?.name || 'RI Admin',
          userRole: req.user?.role || 'ri_admin',
          action: 'RI_COMMUNICATION_EMAIL_SENT',
          studentId: r.student_id || null,
          batchId: batchId || null,
          recordId: resendId,
          details: {
            recipient_email: r.email,
            recipient_name: r.name,
            recipient_role: r.role,
            subject: personalizedSubj,
            template_key: templateKey,
            template_name: RI_EMAIL_TEMPLATES[templateKey]?.name || 'Custom Message',
            batch_id: batchId || null,
            batch_name: r.batch_name || batchInfo?.name || 'Direct Manual',
            village_name: r.village_name || null,
            panel_name: r.panel_name || null,
            status: 'sent',
            delivery_status: 'delivered',
            is_mock: isMock,
            resend_id: resendId,
            is_manual: r.role === 'manual'
          },
          ipAddress: req.ip
        });
      } catch (sendErr) {
        failedCount++;
        const errMsg = sendErr.message || 'Send error';
        results.push({
          email: r.email,
          name: r.name,
          role: r.role,
          status: 'failed',
          error: errMsg
        });

        // Log failure into ri_audit_logs
        await logRiAction(pool, {
          userId: safeUserId,
          userEmail: req.user?.email,
          userName: req.user?.name || 'RI Admin',
          userRole: req.user?.role || 'ri_admin',
          action: 'RI_COMMUNICATION_EMAIL_FAILED',
          studentId: r.student_id || null,
          batchId: batchId || null,
          details: {
            recipient_email: r.email,
            recipient_name: r.name,
            recipient_role: r.role,
            subject: personalizedSubj,
            template_key: templateKey,
            template_name: RI_EMAIL_TEMPLATES[templateKey]?.name || 'Custom Message',
            batch_id: batchId || null,
            batch_name: r.batch_name || batchInfo?.name || 'Direct Manual',
            status: 'failed',
            delivery_status: 'failed',
            error_message: errMsg,
            is_manual: r.role === 'manual'
          },
          ipAddress: req.ip
        });
      }
    }

    return res.json({
      success: true,
      message: `Dispatched ${sentCount} email(s) successfully${failedCount > 0 ? `, ${failedCount} failed.` : '.'}`,
      isMock,
      total: uniqueRecipients.length,
      sent: sentCount,
      failed: failedCount,
      results
    });
  } catch (err) {
    console.error('[RI Communication] Error during email dispatch:', err);
    return res.status(500).json({ message: 'Internal error sending emails', error: err.message });
  }
};

/**
 * 4. Get RI Email Audit Logs
 * Strictly retrieves RI-specific email activity from ri_audit_logs.
 */
const getRiEmailLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      template = 'all',
      dateRange = 'all'
    } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClauses = [
      `action IN ('RI_COMMUNICATION_EMAIL_SENT', 'RI_COMMUNICATION_EMAIL_FAILED')`
    ];

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      whereClauses.push(`(
        LOWER(details->>'recipient_email') LIKE $${pIdx} OR
        LOWER(details->>'recipient_name') LIKE $${pIdx} OR
        LOWER(details->>'subject') LIKE $${pIdx} OR
        LOWER(COALESCE(details->>'batch_name', '')) LIKE $${pIdx} OR
        LOWER(COALESCE(details->>'resend_id', '')) LIKE $${pIdx}
      )`);
    }

    if (status !== 'all') {
      params.push(status.toLowerCase());
      const pIdx = params.length;
      whereClauses.push(`LOWER(COALESCE(details->>'status', '')) = $${pIdx}`);
    }

    if (template !== 'all') {
      params.push(template);
      const pIdx = params.length;
      whereClauses.push(`details->>'template_key' = $${pIdx}`);
    }

    if (dateRange !== 'all') {
      if (dateRange === 'today') {
        whereClauses.push(`created_at >= CURRENT_DATE`);
      } else if (dateRange === '7days') {
        whereClauses.push(`created_at >= NOW() - INTERVAL '7 days'`);
      } else if (dateRange === '30days') {
        whereClauses.push(`created_at >= NOW() - INTERVAL '30 days'`);
      }
    }

    const whereStr = whereClauses.join(' AND ');

    // Count total
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM ri_audit_logs WHERE ${whereStr}`,
      params
    );
    const total = countRes.rows[0].total;

    // Fetch paginated
    params.push(parseInt(limit, 10));
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const logsRes = await pool.query(
      `SELECT 
         id,
         user_id,
         user_name,
         user_email,
         user_role,
         action,
         ri_batch_id,
         details,
         created_at
       FROM ri_audit_logs
       WHERE ${whereStr}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    // Summary counts
    const summaryRes = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_logs,
        COUNT(*) FILTER (WHERE action = 'RI_COMMUNICATION_EMAIL_SENT')::int AS total_sent,
        COUNT(*) FILTER (WHERE action = 'RI_COMMUNICATION_EMAIL_FAILED')::int AS total_failed
      FROM ri_audit_logs
      WHERE action IN ('RI_COMMUNICATION_EMAIL_SENT', 'RI_COMMUNICATION_EMAIL_FAILED')
    `);

    const summary = summaryRes.rows[0] || { total_logs: 0, total_sent: 0, total_failed: 0 };

    return res.json({
      success: true,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      summary,
      logs: logsRes.rows.map(row => ({
        id: row.id,
        action: row.action,
        user_name: row.user_name,
        created_at: row.created_at,
        recipient_email: row.details?.recipient_email || '—',
        recipient_name: row.details?.recipient_name || '—',
        recipient_role: row.details?.recipient_role || 'student',
        subject: row.details?.subject || '—',
        template_name: row.details?.template_name || 'Custom',
        template_key: row.details?.template_key || 'custom',
        batch_name: row.details?.batch_name || '—',
        status: row.details?.status || (row.action === 'RI_COMMUNICATION_EMAIL_SENT' ? 'sent' : 'failed'),
        delivery_status: row.details?.delivery_status || row.details?.status || 'sent',
        error_message: row.details?.error_message || null,
        resend_id: row.details?.resend_id || null,
        is_manual: !!row.details?.is_manual
      }))
    });
  } catch (err) {
    console.error('[RI Communication] Error fetching audit logs:', err);
    return res.status(500).json({ message: 'Failed to fetch email audit logs', error: err.message });
  }
};

module.exports = {
  RI_EMAIL_TEMPLATES,
  getRiBatchesForCommunication,
  getRiBatchRecipients,
  sendRiEmail,
  getRiEmailLogs
};
