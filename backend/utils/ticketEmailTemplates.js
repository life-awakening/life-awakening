const { sendEmail } = require('../services/emailService');

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatIstDate = (dateVal) => {
  const d = dateVal ? new Date(dateVal) : new Date();
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) + ' IST';
};

const getPriorityBadgeStyle = (priority) => {
  const p = (priority || 'medium').toLowerCase();
  if (p === 'urgent') return 'background:#fee2e2;color:#991b1b;border:1px solid #f87171;';
  if (p === 'high') return 'background:#ffedd5;color:#9a3412;border:1px solid #fdba74;';
  if (p === 'low') return 'background:#f0fdf4;color:#166534;border:1px solid #86efac;';
  return 'background:#fef9c3;color:#854d0e;border:1px solid #fde047;';
};

/**
 * Builds LTC-branded HTML email for new ticket notifications to admins
 */
const buildNewTicketEmailHtml = ({
  ticketId,
  userName,
  userRole,
  userEmail,
  category,
  priority,
  subject,
  description,
  onBehalfOf,
  createdAt
}) => {
  const safeId = escapeHtml(String(ticketId));
  const safeName = escapeHtml(userName || 'User');
  const safeRole = escapeHtml((userRole || 'User').toUpperCase());
  const safeEmail = escapeHtml(userEmail || '—');
  const safeCategory = escapeHtml(category || 'General');
  const safePriority = escapeHtml((priority || 'Medium').toUpperCase());
  const safeSubject = escapeHtml(subject || 'No Subject');
  const safeDesc = escapeHtml(description || 'No description provided.').replace(/\n/g, '<br/>');
  const safeDate = formatIstDate(createdAt);
  const priorityStyle = getPriorityBadgeStyle(priority);
  const isStudent = !userRole || String(userRole).toLowerCase() === 'student';
  const showPriority = !isStudent && Boolean(priority);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Support Ticket #${safeId}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #0f172a 0%, #154388 100%);padding:28px 24px;border-bottom:3px solid #d97706;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:#fbbf24;text-transform:uppercase;margin-bottom:6px;">
                      MIT-WPU • Life Awakening Program
                    </div>
                    <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.2;">
                      New Support Ticket Raised
                    </div>
                    <div style="font-size:13px;color:#93c5fd;margin-top:4px;">
                      Ticket ID: #${safeId}
                    </div>
                  </td>
                  ${showPriority ? `
                  <td align="right" valign="top">
                    <span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;${priorityStyle}">
                      ${safePriority} PRIORITY
                    </span>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:24px;">
              
              <!-- Ticket Subject Header -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #154388;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
                  Issue Title
                </div>
                <div style="font-size:16px;font-weight:700;color:#0f172a;line-height:1.3;">
                  ${safeSubject}
                </div>
              </div>

              <!-- Metadata Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;width:35%;font-size:12px;font-weight:600;color:#64748b;">
                    Raised By:
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#0f172a;">
                    ${safeName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;">
                    User Role:
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">
                    <span style="background-color:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">
                      ${safeRole}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;">
                    User Email:
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">
                    <a href="mailto:${safeEmail}" style="color:#2563eb;text-decoration:none;">${safeEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;">
                    Category:
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#334155;">
                    ${safeCategory}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;">
                    Time Raised:
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;">
                    ${safeDate}
                  </td>
                </tr>
                ${onBehalfOf ? `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600;color:#64748b;">
                    On Behalf Of:
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;color:#475569;">
                    ${escapeHtml(onBehalfOf)}
                  </td>
                </tr>` : ''}
              </table>

              <!-- Full Issue Description -->
              <div style="font-size:12px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                Full Description
              </div>
              <div style="background-color:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:16px;font-size:13.5px;line-height:1.6;color:#1e293b;margin-bottom:12px;white-space:pre-wrap;">${safeDesc}</div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:18px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:11.5px;color:#64748b;line-height:1.5;">
              This is an automated operational notification generated by the <strong>MIT-WPU LTC Support Portal</strong>.<br/>
              To act on this ticket, log in to your administrative dashboard.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Builds LTC-branded HTML email for ticket resolved notification to ticket raiser
 */
const buildResolvedTicketEmailHtml = ({
  ticketId,
  raiserName,
  subject,
  description,
  resolution,
  resolvedAt
}) => {
  const safeId = escapeHtml(String(ticketId));
  const safeName = escapeHtml(raiserName || 'Student/Faculty Member');
  const safeSubject = escapeHtml(subject || 'Support Ticket');
  const safeDesc = escapeHtml(description || '—').replace(/\n/g, '<br/>');
  const safeResolution = escapeHtml(resolution || 'The issue has been verified and resolved by the LTC administration.').replace(/\n/g, '<br/>');
  const safeResolvedAt = formatIstDate(resolvedAt);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Resolved #${safeId}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #154388 0%, #15803d 100%);padding:28px 24px;border-bottom:3px solid #22c55e;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:#bbf7d0;text-transform:uppercase;margin-bottom:6px;">
                MIT-WPU • Life Awakening Program
              </div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.2;">
                Support Ticket Resolved
              </div>
              <div style="font-size:13px;color:#dcfce7;margin-top:4px;">
                Ticket #${safeId} • Status: RESOLVED
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px 0;font-size:14px;color:#334155;line-height:1.5;">
                Dear <strong>${safeName}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:14px;color:#334155;line-height:1.5;">
                Your support request has been reviewed and marked as <strong>Resolved</strong> by the LTC Administration.
              </p>

              <!-- Resolution Box (Primary Feature) -->
              <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;padding:16px;margin-bottom:24px;">
                <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
                  Official Resolution Note
                </div>
                <div style="font-size:14px;font-weight:500;color:#14532d;line-height:1.6;white-space:pre-wrap;">${safeResolution}</div>
              </div>

              <!-- Ticket Summary Recap -->
              <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
                Ticket Details
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;border-collapse:collapse;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;width:30%;font-size:12px;font-weight:600;color:#64748b;">
                    Ticket ID:
                  </td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12.5px;font-weight:600;color:#0f172a;">
                    #${safeId}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#64748b;">
                    Issue Title:
                  </td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12.5px;font-weight:600;color:#0f172a;">
                    ${safeSubject}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#64748b;">
                    Status:
                  </td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;">
                    <span style="background-color:#dcfce7;color:#15803d;padding:2px 8px;border-radius:4px;font-weight:700;">
                      RESOLVED
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#64748b;">
                    Resolved Date:
                  </td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">
                    ${safeResolvedAt}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#64748b;vertical-align:top;">
                    Original Issue:
                  </td>
                  <td style="padding:10px 14px;font-size:12.5px;color:#334155;line-height:1.5;">
                    ${safeDesc}
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0 0;font-size:13px;color:#64748b;line-height:1.5;">
                If your issue is not fully resolved or if you have any follow-up queries, you may raise a new ticket from your dashboard.
              </p>
              
              <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:13px;color:#334155;line-height:1.5;">
                Best regards,<br/>
                <strong>LTC Administration</strong><br/>
                <span style="font-size:12px;color:#64748b;">MIT World Peace University</span>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:11.5px;color:#64748b;line-height:1.5;">
              This is an official automated notification from <strong>Life Awakening Program Support</strong>.<br/>
              Please do not reply directly to this email.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Dispatches automated notifications for newly raised tickets
 */
const sendNewTicketNotifications = async (ticketData) => {
  const recipients = ['ahsanimamkhan06@gmail.com', 'nk120104@gmail.com'];
  const html = buildNewTicketEmailHtml(ticketData);
  const subject = `[LTC Support] New Ticket #${ticketData.ticketId}: ${ticketData.subject || 'Support Request'}`;

  const isStudent = !ticketData.userRole || String(ticketData.userRole).toLowerCase() === 'student';
  const priorityLine = (!isStudent && ticketData.priority) ? `Priority: ${ticketData.priority}\n` : '';

  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject,
        html,
        text: `New Support Ticket #${ticketData.ticketId} raised by ${ticketData.userName} (${ticketData.userRole}): ${ticketData.subject}\n\n${priorityLine}Category: ${ticketData.category}\n\nDescription:\n${ticketData.description}`
      });
      console.log(`[Ticket Notification] New ticket #${ticketData.ticketId} notification sent to ${to}`);
    } catch (err) {
      console.error(`[Ticket Notification Error] Failed to send to ${to}:`, err.message);
    }
  }
};

/**
 * Dispatches automated notification to ticket raiser when ticket is resolved
 */
const sendTicketResolvedNotification = async (ticketData) => {
  if (!ticketData.raiserEmail) {
    console.warn(`[Ticket Resolved Notification] No raiser email for ticket #${ticketData.ticketId}. Skipping email.`);
    return;
  }

  const html = buildResolvedTicketEmailHtml(ticketData);
  const subject = `[LTC Support] Ticket Resolved #${ticketData.ticketId}: ${ticketData.subject || 'Your Support Request'}`;

  try {
    await sendEmail({
      to: ticketData.raiserEmail,
      subject,
      html,
      text: `Dear ${ticketData.raiserName},\n\nYour support ticket #${ticketData.ticketId} ("${ticketData.subject}") has been marked as Resolved.\n\nResolution:\n${ticketData.resolution}\n\nBest regards,\nLTC Administration`
    });
    console.log(`[Ticket Notification] Resolution notification sent to ${ticketData.raiserEmail} for ticket #${ticketData.ticketId}`);
  } catch (err) {
    console.error(`[Ticket Notification Error] Failed to send resolution email to ${ticketData.raiserEmail}:`, err.message);
  }
};

module.exports = {
  buildNewTicketEmailHtml,
  buildResolvedTicketEmailHtml,
  sendNewTicketNotifications,
  sendTicketResolvedNotification
};
