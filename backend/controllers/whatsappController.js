const pool = require('../config/db');
const { uploadMetaMedia } = require('../services/whatsappService');
const { writeAudit } = require('../utils/helpers');

/**
 * Normalizes Indian phone numbers to Meta international format (919XXXXXXXXX).
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return '91' + cleaned;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned;
  }
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }
  return null;
};

/**
 * Helper to shorten date strings to prevent Meta body length limits (1024 cap)
 */
const formatCompactDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  const cleaned = dateStr.trim();
  const match = cleaned.match(/(\d{1,2})\s*([A-Za-z]+|\d{1,2})/);
  if (match) {
    const day = match[1];
    let month = match[2];
    if (month.length > 3) month = month.substring(0, 3);
    return `${day} ${month}`;
  }
  return cleaned.substring(0, 10);
};

/**
 * Initiates the LRP Welcome WhatsApp Campaign
 */
const sendLrpWelcomeCampaign = async (req, res) => {
  const { 
    studentIds, 
    manualPhones, 
    batchId, 
    programDates, 
    mediaId, 
    buttonParam, 
    sendTo = 'student', 
    templateName = 'lrp_welcome_marketing',
    marketingVars
  } = req.body;

  const isManual = Boolean(manualPhones && typeof manualPhones === 'string' && manualPhones.trim().length > 0);

  if (!isManual && !batchId) {
    return res.status(400).json({ message: 'Batch ID is required for student list selection.' });
  }
  if (!programDates && templateName === 'ltc_program_welcome') {
    return res.status(400).json({ message: 'Program dates configuration is required.' });
  }

  const activeTemplateName = templateName || 'ltc_program_welcome';
  const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let batchName = (marketingVars?.var2Batch) || (programDates?.batch_name) || 'Batch 1';

    // 1. Fetch batch details if batchId is provided
    if (batchId) {
      const batchRes = await client.query(
        `SELECT name FROM batches WHERE id = $1 AND is_deleted IS NOT TRUE`,
        [batchId]
      );
      if (batchRes.rowCount > 0) {
        batchName = batchRes.rows[0].name;

        // 2. Save the configured program dates to the batches table
        if (programDates) {
          const { ri_start, ri_end, lrp_start, lrp_end, report_date, report_time, collect_date, return_date } = programDates;
          await client.query(
            `UPDATE batches 
             SET ri_start = $1, ri_end = $2, lrp_start = $3, lrp_end = $4,
                 report_date = $5, report_time = $6, collect_date = $7, return_date = $8
             WHERE id = $9`,
            [ri_start || null, ri_end || null, lrp_start || null, lrp_end || null,
             report_date || null, report_time || null, collect_date || null, return_date || null,
             batchId]
          );
        }
      }
    }

    let targets = [];

    // Mode A: Manual phone numbers entered
    if (manualPhones && typeof manualPhones === 'string' && manualPhones.trim().length > 0) {
      const rawNums = manualPhones.split(/[\s,\n]+/).map(n => n.trim()).filter(Boolean);
      const uniqueRawNums = Array.from(new Set(rawNums));

      // Fetch all students to match names
      const studentsRes = await client.query(
        `SELECT id, name, phone, parent_mobile FROM users WHERE role = 'student'`
      );

      const phoneToStudent = {};
      studentsRes.rows.forEach(s => {
        const studentClean = normalizePhone(s.phone);
        const parentClean = normalizePhone(s.parent_mobile);
        if (studentClean) phoneToStudent[studentClean] = s;
        if (parentClean) phoneToStudent[parentClean] = s;
      });

      uniqueRawNums.forEach(rawNum => {
        const cleanPhone = normalizePhone(rawNum);
        if (!cleanPhone) {
          targets.push({
            studentId: null,
            phone: rawNum,
            name: 'Student',
            label: 'Manual Input (Invalid)',
            invalid: true,
            error: `Invalid phone format: "${rawNum}"`
          });
        } else {
          const matchedStudent = phoneToStudent[cleanPhone];
          targets.push({
            studentId: matchedStudent ? matchedStudent.id : null,
            phone: cleanPhone,
            name: matchedStudent ? matchedStudent.name : 'Student',
            label: matchedStudent ? `Manual Input (Matched: ${matchedStudent.name})` : 'Manual Input'
          });
        }
      });

    } else {
      // Mode B: Standard student checkbox list selection
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        throw new Error('At least one student must be selected or manual phone numbers entered.');
      }

      const studentsRes = await client.query(
        `SELECT id, name, phone, parent_mobile FROM users WHERE id = ANY($1) AND role = 'student'`,
        [studentIds]
      );

      const studentsMap = {};
      studentsRes.rows.forEach(s => {
        studentsMap[s.id] = s;
      });

      studentIds.forEach(studentId => {
        const student = studentsMap[studentId];
        if (!student) {
          targets.push({
            studentId,
            phone: 'N/A',
            name: 'Unknown',
            label: 'N/A',
            invalid: true,
            error: 'Student not found in database'
          });
        } else {
          const cleanStudentPhone = normalizePhone(student.phone);
          const cleanParentPhone = normalizePhone(student.parent_mobile);

          if (sendTo === 'student' || sendTo === 'both') {
            if (!cleanStudentPhone) {
              targets.push({
                studentId: student.id,
                phone: student.phone || 'N/A',
                name: student.name,
                label: 'Student Mobile',
                invalid: true,
                error: `Invalid student mobile format: "${student.phone || ''}"`
              });
            } else {
              targets.push({
                studentId: student.id,
                phone: cleanStudentPhone,
                name: student.name,
                label: 'Student Mobile'
              });
            }
          }

          if (sendTo === 'parent' || sendTo === 'both') {
            if (!cleanParentPhone) {
              targets.push({
                studentId: student.id,
                phone: student.parent_mobile || 'N/A',
                name: student.name,
                label: 'Parent Mobile',
                invalid: true,
                error: `Invalid parent mobile format: "${student.parent_mobile || ''}"`
              });
            } else {
              targets.push({
                studentId: student.id,
                phone: cleanParentPhone,
                name: student.name,
                label: `Parent of ${student.name}`
              });
            }
          }
        }
      });
    }

    // 3. Create the campaign header
    await client.query(
      `INSERT INTO whatsapp_campaigns (id, batch_id, template_name, media_id, status, total_count, sent_count, failed_count)
       VALUES ($1, $2, $3, $4, 'pending', $5, 0, 0)`,
      [campaignId, batchId, activeTemplateName, mediaId || null, targets.length]
    );

    let validCount = 0;
    let failedCount = 0;

    for (const target of targets) {
      if (target.invalid) {
        failedCount++;
        await client.query(
          `INSERT INTO whatsapp_campaign_logs (campaign_id, student_id, phone, status, error_message, sent_at)
           VALUES ($1, $2, $3, 'failed', $4, NOW())`,
          [campaignId, target.studentId, target.phone || 'N/A', target.error || 'Validation error']
        );
        continue;
      }

      let bodyParams = [];
      if (activeTemplateName === 'lrp_welcome_marketing') {
        const mVars = marketingVars || {};
        const v1Mode = mVars.var1Mode || 'student_name';

        let v1 = '';
        if (v1Mode === 'literal' || v1Mode === 'custom') {
          v1 = (mVars.var1Custom || 'student and parents').trim();
        } else if (v1Mode === 'name_and_parents') {
          let sName = (target.name || 'Student').trim();
          if (sName.length > 25) sName = sName.substring(0, 22) + '...';
          v1 = `${sName} and parents`;
        } else {
          let sName = (target.name || 'Student').trim();
          if (sName.length > 35) sName = sName.substring(0, 32) + '...';
          v1 = sName;
        }

        let v2 = (mVars.var2Batch || batchName || 'LAP Batch 01').trim();
        let v3 = (mVars.var3Role || 'Student').trim();

        // Strict Meta API sanitization: strip newlines and cap parameter length at 35 chars
        v1 = v1.replace(/[\r\n]+/g, ' ').trim();
        v2 = v2.replace(/[\r\n]+/g, ' ').trim();
        v3 = v3.replace(/[\r\n]+/g, ' ').trim();

        if (v1.length > 35) v1 = v1.substring(0, 32) + '...';
        if (v2.length > 35) v2 = v2.substring(0, 32) + '...';
        if (v3.length > 35) v3 = v3.substring(0, 32) + '...';

        bodyParams = [v1, v2, v3];
      } else if (activeTemplateName === 'ltc_notification') {
        const mVars = marketingVars || {};
        const v1Mode = mVars.var1Mode || 'student_name';

        let v1 = '';
        if (v1Mode === 'students_and_parents') {
          v1 = 'students and parents';
        } else if (v1Mode === 'student_and_parents') {
          v1 = 'student and parents';
        } else if (v1Mode === 'custom' || v1Mode === 'literal') {
          v1 = (mVars.var1CustomText || mVars.var1Custom || 'students and parents').trim();
        } else if (v1Mode === 'name_and_parents') {
          let sName = (target.name || 'Student').trim();
          if (sName.length > 20) sName = sName.substring(0, 17) + '...';
          v1 = `${sName} and parents`;
        } else {
          let sName = (target.name || 'Student').trim();
          if (sName.length > 35) sName = sName.substring(0, 32) + '...';
          v1 = sName;
        }

        let v2 = (mVars.var1Custom || `Welcome to Life Awakening Program (LAP). We are delighted to have you join ${batchName || 'LAP-01-1026'}.`).trim();

        // Strip newlines and cap parameter length for Meta Cloud API
        v1 = v1.replace(/[\r\n]+/g, ' ').trim();
        v2 = v2.replace(/[\r\n]+/g, ' ').trim();

        if (v1.length > 35) v1 = v1.substring(0, 32) + '...';
        if (v2.length > 900) v2 = v2.substring(0, 895) + '...';

        bodyParams = [v1, v2];
      } else if (activeTemplateName === 'ltc_program_welcome') {
        const fmtStartDate = (programDates?.start_date || programDates?.ri_start || '18/02/2026').trim();
        const fmtEndDate = (programDates?.end_date || programDates?.ri_end || '12/02/2026').trim();
        const channelUrl = (programDates?.channel || 'https://whatsapp.com/channel/0029Vb8jqDQ5PO0u8OM6820h').trim();

        let sName = (target.name || 'Student').trim();
        if (sName.length > 35) {
          sName = sName.substring(0, 32) + '...';
        }

        // 5 Meta-approved parameters for ltc_program_welcome
        bodyParams = [
          { type: 'text', parameter_name: 'student_name', text: sName },
          { type: 'text', parameter_name: 'batch_name', text: batchName || 'batch 1' },
          { type: 'text', parameter_name: 'start_date', text: fmtStartDate },
          { type: 'text', parameter_name: 'end_date', text: fmtEndDate },
          { type: 'text', parameter_name: 'channel', text: channelUrl }
        ];
      } else {
        // Fallback to 6 variables for lrp_welcome_student_v1
        bodyParams = [
          target.name,                                      // 1. {{1}} = Student Name
          'Student',                                        // 2. {{2}} = Role/Text (Student)
          batchName,                                        // 3. {{3}} = Batch Name
          target.squad || 'N/A',                            // 4. {{4}} = Squad Name
          ri_start || 'N/A',                                // 5. {{5}} = Start Date
          ri_end || 'N/A'                                   // 6. {{6}} = End Date
        ];
      }

      const templateVariables = {
        bodyParams,
        buttonParam: buttonParam || null
      };

      const templatesWithHeaderImage = ['lrp_welcome_student_v1', 'ltc_program_welcome'];
      const effectiveMediaId = templatesWithHeaderImage.includes(activeTemplateName) ? (mediaId || null) : null;

      // Queue the template dispatch message
      await client.query(
        `INSERT INTO whatsapp_queue (to_phone, body, status, campaign_id, student_id, template_name, template_variables, media_id)
         VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)`,
        [target.phone, `${activeTemplateName} to ${target.label}`, campaignId, target.studentId, activeTemplateName, JSON.stringify(templateVariables), effectiveMediaId]
      );
      validCount++;
    }

    // 5. Update campaign count with failures processed instantly
    if (failedCount > 0) {
      await client.query(
        `UPDATE whatsapp_campaigns 
         SET failed_count = failed_count + $1,
             status = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [failedCount, (failedCount === targets.length) ? 'completed' : 'processing', campaignId]
      );
    }

    await client.query('COMMIT');
    
    writeAudit(req.user.id, req.user.name || 'Admin', 'WHATSAPP_CAMPAIGN_QUEUED', 'batch', parseInt(batchId), { 
      campaignId, 
      recipient_count: targets.length,
      valid_count: validCount,
      failed_count: failedCount 
    });

    res.json({
      success: true,
      campaignId,
      totalCount: targets.length,
      queuedCount: validCount,
      failedCount,
      message: `WhatsApp Welcome Campaign queued successfully. ${validCount} queued, ${failedCount} rejected due to formatting issues.`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error starting LRP welcome WhatsApp campaign:', err);
    res.status(500).json({ message: err.message || 'Failed to queue campaign.' });
  } finally {
    client.release();
  }
};

/**
 * Retrieves the status and logs of a WhatsApp campaign
 */
const getCampaignStatus = async (req, res) => {
  const { campaignId } = req.params;

  try {
    const campaignRes = await pool.query(
      `SELECT c.*, b.name as batch_name 
       FROM whatsapp_campaigns c
       LEFT JOIN batches b ON c.batch_id = b.id
       WHERE c.id = $1`,
      [campaignId]
    );

    if (campaignRes.rowCount === 0) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }

    const campaign = campaignRes.rows[0];
    const defaultBatchName = campaign.batch_name || 'BATCH 1';

    // Fetch logs from whatsapp_campaign_logs
    const logsRes = await pool.query(
      `SELECT l.id, COALESCE(u.name, 'Student') as student_name, l.phone, l.status, l.meta_message_id, l.error_message as reason, l.sent_at,
              COALESCE(l.template_name, c.template_name, 'ltc_notification') as template_name,
              $2 as batch_name,
              CASE 
                WHEN u.parent_mobile IS NOT NULL AND l.phone = u.parent_mobile THEN 'Parent'
                WHEN u.phone IS NOT NULL AND l.phone = u.phone THEN 'Student'
                ELSE 'Student/Parent'
              END as role
       FROM whatsapp_campaign_logs l
       LEFT JOIN users u ON l.student_id = u.id
       LEFT JOIN whatsapp_campaigns c ON l.campaign_id = c.id
       WHERE l.campaign_id = $1
       ORDER BY l.sent_at DESC
       LIMIT 500`,
      [campaignId, defaultBatchName]
    );

    // Also fetch queue items (to catch pending/processing/queued numbers)
    const queueRes = await pool.query(
      `SELECT q.id, COALESCE(u.name, 'Student') as student_name, q.to_phone as phone, q.status, q.error_message as reason, q.updated_at as sent_at,
              COALESCE(q.template_name, c.template_name, 'ltc_notification') as template_name,
              $2 as batch_name,
              CASE 
                WHEN u.parent_mobile IS NOT NULL AND q.to_phone = u.parent_mobile THEN 'Parent'
                WHEN u.phone IS NOT NULL AND q.to_phone = u.phone THEN 'Student'
                ELSE 'Student/Parent'
              END as role
       FROM whatsapp_queue q
       LEFT JOIN users u ON q.student_id = u.id
       LEFT JOIN whatsapp_campaigns c ON q.campaign_id = c.id
       WHERE q.campaign_id = $1
       ORDER BY q.created_at DESC
       LIMIT 500`,
      [campaignId, defaultBatchName]
    );

    const loggedPhones = new Set(logsRes.rows.map(l => l.phone));
    const allLogs = [...logsRes.rows];

    queueRes.rows.forEach(q => {
      if (!loggedPhones.has(q.phone)) {
        allLogs.push({
          id: `q_${q.id}`,
          student_name: q.student_name,
          phone: q.phone,
          batch_name: q.batch_name,
          role: q.role,
          status: q.status === 'permanent_fail' ? 'failed' : q.status,
          meta_message_id: null,
          reason: q.reason || (q.status === 'pending' ? 'Queued - awaiting dispatch' : q.status === 'processing' ? 'Sending via Meta API...' : 'Failed'),
          sent_at: q.sent_at
        });
      }
    });

    const failures = allLogs.filter(l => l.status === 'failed' || l.status === 'permanent_fail');
    const sentItems = allLogs.filter(l => l.status === 'sent' || l.status === 'delivered');
    const pendingItems = allLogs.filter(l => l.status === 'pending' || l.status === 'processing');

    const actual_sent_count = Math.max(parseInt(campaign.sent_count || 0), sentItems.length);
    const actual_failed_count = Math.max(parseInt(campaign.failed_count || 0), failures.length);
    const total_count = Math.max(parseInt(campaign.total_count || 0), allLogs.length);
    
    const processed = actual_sent_count + actual_failed_count;
    const progress = total_count > 0 ? Math.min(100, parseFloat(((processed / total_count) * 100).toFixed(1))) : 0;

    let computedStatus = campaign.status;
    if (processed >= total_count && total_count > 0) {
      computedStatus = 'completed';
    } else if (actual_failed_count > 0 && actual_sent_count === 0 && pendingItems.length === 0) {
      computedStatus = 'failed';
    } else if (processed > 0 || pendingItems.length > 0) {
      computedStatus = 'processing';
    }

    // Keep database campaign row synchronized
    if (computedStatus !== campaign.status || actual_sent_count !== parseInt(campaign.sent_count || 0) || actual_failed_count !== parseInt(campaign.failed_count || 0)) {
      pool.query(
        `UPDATE whatsapp_campaigns SET status = $1, sent_count = $2, failed_count = $3, updated_at = NOW() WHERE id = $4`,
        [computedStatus, actual_sent_count, actual_failed_count, campaignId]
      ).catch(e => console.error('Error updating campaign row:', e.message));
    }

    res.json({
      id: campaign.id,
      batch_id: campaign.batch_id,
      batch_name: defaultBatchName,
      template_name: campaign.template_name,
      status: computedStatus,
      total_count,
      sent_count: actual_sent_count,
      failed_count: actual_failed_count,
      processed_count: processed,
      progress,
      logs: allLogs,
      failures,
      sentItems
    });

  } catch (err) {
    console.error('Error fetching campaign status:', err);
    res.status(500).json({ message: 'Server error retrieving status.', error: err.message });
  }
};

/**
 * Retrieves list of recent WhatsApp campaigns
 */
const getRecentCampaigns = async (req, res) => {
  try {
    const campaignsRes = await pool.query(
      `SELECT c.*, b.name as batch_name
       FROM whatsapp_campaigns c
       LEFT JOIN batches b ON c.batch_id = b.id
       ORDER BY c.created_at DESC
       LIMIT 20`
    );

    const campaigns = campaignsRes.rows.map(c => {
      const total_count = parseInt(c.total_count || 0);
      const sent_count = parseInt(c.sent_count || 0);
      const failed_count = parseInt(c.failed_count || 0);
      const processed_count = sent_count + failed_count;
      const progress = total_count > 0 ? parseFloat(((processed_count / total_count) * 100).toFixed(1)) : 0;

      return {
        id: c.id,
        batch_id: c.batch_id,
        batch_name: c.batch_name || 'N/A',
        template_name: c.template_name,
        status: c.status,
        total_count,
        sent_count,
        failed_count,
        processed_count,
        progress,
        created_at: c.created_at,
        updated_at: c.updated_at
      };
    });

    res.json({ success: true, campaigns });
  } catch (err) {
    console.error('Error fetching recent campaigns:', err);
    res.status(500).json({ message: 'Failed to fetch campaigns list.', error: err.message });
  }
};

/**
 * Uploads media file to Meta WhatsApp Cloud API
 */
const uploadMedia = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded. Please send an image file.' });
  }

  try {
    let fileBuffer = req.file.buffer;
    if ((!fileBuffer || fileBuffer.length === 0) && req.file.path) {
      const fs = require('fs');
      fileBuffer = fs.readFileSync(req.file.path);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ message: 'Uploaded file is empty or could not be read.' });
    }

    const mimeType = req.file.mimetype || 'image/jpeg';
    const filename = req.file.originalname || 'banner.jpg';

    console.log(`[Media Upload] Forwarding banner ${filename} (${fileBuffer.length} bytes, ${mimeType}) to Meta...`);
    const { mediaId } = await uploadMetaMedia(fileBuffer, mimeType, filename);

    res.json({
      success: true,
      mediaId,
      message: 'Banner uploaded successfully to Meta WhatsApp storage.'
    });

  } catch (err) {
    console.error('Error uploading media banner to Meta:', err);
    res.status(500).json({ message: `Failed to upload image banner to Meta WhatsApp API: ${err.message}`, error: err.message });
  }
};

/**
 * Retrieves the latest 500 delivery logs, optionally filtered by template_name
 */
const getTemplateLogs = async (req, res) => {
  const { template_name, limit } = req.query;
  const logLimit = parseInt(limit || '500');

  try {
    let queryParams = [logLimit];
    let whereClause = '';

    if (template_name && template_name.trim() && template_name !== 'all') {
      queryParams.push(template_name.trim());
      whereClause = `WHERE (l.template_name = $2 OR c.template_name = $2)`;
    }

    const logsRes = await pool.query(
      `SELECT l.id, 
              COALESCE(u.name, (SELECT name FROM users u2 WHERE u2.phone = l.phone OR u2.parent_mobile = l.phone LIMIT 1), 'Recipient') as student_name, 
              l.phone, 
              l.status, 
              COALESCE(l.template_name, c.template_name, 'ltc_notification') as template_name,
              COALESCE(b.name, 'Direct Dispatch') as batch_name,
              CASE 
                WHEN u.parent_mobile IS NOT NULL AND l.phone = u.parent_mobile THEN 'Parent'
                WHEN u.phone IS NOT NULL AND l.phone = u.phone THEN 'Student'
                ELSE 'Student/Parent'
              END as role,
              l.meta_message_id, 
              l.error_message as reason, 
              l.sent_at
       FROM whatsapp_campaign_logs l
       LEFT JOIN users u ON l.student_id = u.id
       LEFT JOIN whatsapp_campaigns c ON l.campaign_id = c.id
       LEFT JOIN batches b ON c.batch_id = b.id
       ${whereClause}
       ORDER BY l.sent_at DESC
       LIMIT $1`,
      queryParams
    );

    res.json({
      success: true,
      template_name: template_name || 'all',
      count: logsRes.rows.length,
      logs: logsRes.rows
    });
  } catch (err) {
    console.error('Error fetching template logs:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch template logs.' });
  }
};

module.exports = {
  sendLrpWelcomeCampaign,
  getCampaignStatus,
  getRecentCampaigns,
  uploadMedia,
  getTemplateLogs
};
