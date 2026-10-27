const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const s3Service = require('../services/s3Service');
const { createSystemNotification, withLtcId } = require('../utils/helpers');
const { resolveFacultyBatch } = require('../utils/batchResolver');
const { sendNewTicketNotifications, sendTicketResolvedNotification } = require('../utils/ticketEmailTemplates');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const jwt = require('jsonwebtoken');

const serveMediaFile = async (req, res) => {
  let { key } = req.query;
  if (!key) {
    return res.status(400).send('File key is required');
  }

  try {
    let cleanKey = decodeURIComponent(key);
    if (cleanKey.includes('.amazonaws.com/')) {
      cleanKey = cleanKey.split('.amazonaws.com/')[1];
    }

    const storageType = process.env.STORAGE_TYPE || 'local';

    if (storageType === 's3' || cleanKey.startsWith('journey/') || cleanKey.startsWith('ri_faculty_uploads/') || cleanKey.startsWith('ri_student_uploads/')) {
      try {
        const s3Response = await s3Service.getObjectStream(cleanKey, req.headers.range);

        if (s3Response.ContentType) {
          res.setHeader('Content-Type', s3Response.ContentType);
        }
        if (s3Response.ContentLength) {
          res.setHeader('Content-Length', s3Response.ContentLength);
        }
        if (s3Response.ContentRange) {
          res.setHeader('Content-Range', s3Response.ContentRange);
          res.status(206);
        } else {
          res.status(200);
        }

        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Accept-Ranges', 'bytes');

        return s3Response.Body.pipe(res);
      } catch (s3Err) {
        const localPath = path.join(__dirname, '..', 'uploads', cleanKey);
        if (fs.existsSync(localPath)) {
          return res.sendFile(localPath);
        }
        throw s3Err;
      }
    } else {
      const localPath = path.join(__dirname, '..', 'uploads', cleanKey);
      if (fs.existsSync(localPath)) {
        return res.sendFile(localPath);
      }
      return res.status(404).send('File not found');
    }
  } catch (err) {
    console.error('Media serve error:', err.message);
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).send('File not found');
    }
    return res.status(500).send('Error serving media file');
  }
};

const verifyBarcode = async (req, res) => {
  const { barcode } = req.query;
  try {
    const user = await pool.query(
      "SELECT id, name, email, department, squad, room, barcode FROM users WHERE barcode = $1",
      [barcode]
    );
    if (user.rowCount === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: user.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const uploadDocument = async (req, res) => {
  const { name, url, file_type, description, target_role, batch_id } = req.body;
  try {
    const doc = await pool.query(
      "INSERT INTO documents (name, url, uploaded_by, target_role, file_type, description, batch_id, current_version) VALUES ($1, $2, $3, $4, $5, $6, $7, 1) RETURNING *",
      [name, url, req.user.id, target_role || 'all', file_type || 'Document', description || '', batch_id || null]
    );

    // Create first version entry in document_versions
    await pool.query(
      "INSERT INTO document_versions (document_id, version, url, uploaded_by) VALUES ($1, 1, $2, $3)",
      [doc.rows[0].id, url, req.user.id]
    );

    res.json({ message: 'Document uploaded', document: doc.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteDocument = async (req, res) => {
  try {
    await pool.query("DELETE FROM documents WHERE id = $1", [req.params.id]);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getDocuments = async (req, res) => {
  try {
    let docs;
    if (req.user.role === 'admin') {
      docs = await pool.query("SELECT * FROM documents ORDER BY id DESC");
    } else {
      docs = await pool.query(
        "SELECT * FROM documents WHERE target_role = $1 OR target_role = 'all' ORDER BY id DESC",
        [req.user.role]
      );
    }
    res.json({ documents: docs.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getSchedules = async (req, res) => {
  try {
    let activeBatchId = null;

    if (req.user.role === 'faculty' || req.user.role === 'ltc_member') {
      // Resolve active batch — returns ACTIVE status batch first
      const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);
      if (activeBatchRow) activeBatchId = activeBatchRow.batch_id;

    } else if (req.user.role === 'student') {
      const activeBatchRes = await pool.query(
        `SELECT bs.batch_id FROM batch_students bs
         JOIN batches b ON bs.batch_id = b.id
         WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
         ORDER BY bs.batch_id DESC LIMIT 1`,
        [req.user.id]
      );
      if (activeBatchRes.rowCount > 0) activeBatchId = activeBatchRes.rows[0].batch_id;

    } else if (req.user.role === 'admin') {
      const { batchId } = req.query;
      if (batchId) activeBatchId = parseInt(batchId);
    }

    let query;
    if (req.user.role === 'admin') {
      if (activeBatchId) {
        query = await pool.query(
          "SELECT * FROM schedules WHERE batch_id = $1 ORDER BY date ASC, time ASC",
          [activeBatchId]
        );
      } else {
        query = await pool.query("SELECT * FROM schedules ORDER BY id ASC");
      }

    } else if (req.user.role === 'faculty' || req.user.role === 'ltc_member') {
      if (activeBatchId) {
        query = await pool.query(
          `SELECT * FROM schedules
           WHERE batch_id = $1
           ORDER BY date ASC, time ASC`,
          [activeBatchId]
        );
      } else {
        query = await pool.query(
          `SELECT * FROM schedules
           WHERE (batch_id IS NULL) AND (faculty_id = $1 OR panel = 'ALL')
           ORDER BY id ASC`,
          [req.user.id]
        );
      }

    } else {
      // Student
      if (activeBatchId) {
        query = await pool.query(
          `SELECT * FROM schedules
           WHERE batch_id = $1 AND (panel = 'ALL' OR panel = $2)
           ORDER BY id ASC`,
          [activeBatchId, req.user.panel || 'Unassigned']
        );
      } else {
        query = await pool.query(
          `SELECT * FROM schedules
           WHERE (batch_id IS NULL) AND (panel = 'ALL' OR panel = $1)
           ORDER BY id ASC`,
          [req.user.panel || 'Unassigned']
        );
      }
    }
    res.json({ schedules: query.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.semester, u.division, u.school, u.panel, u.is_primary, u.password_changed,
              (CASE 
                WHEN u.role = 'student' THEN (
                  SELECT bs.squad FROM batch_students bs
                  JOIN batches b ON bs.batch_id = b.id
                  WHERE bs.student_id = u.id AND (b.is_deleted = false OR b.is_deleted IS NULL)
                  ORDER BY bs.batch_id DESC LIMIT 1
                )
                WHEN u.role = 'faculty' OR u.role = 'ltc_member' THEN (
                  SELECT bf.squad FROM batch_faculty bf
                  JOIN batches b ON bf.batch_id = b.id
                  WHERE bf.faculty_id = u.id AND (b.is_deleted = false OR b.is_deleted IS NULL)
                  ORDER BY
                    CASE
                      WHEN b.status IN ('active', 'Immersion')                             THEN 1
                      WHEN b.status IN ('upcoming', 'Created', 'Planning', 'Orientation') THEN 2
                      ELSE 3
                    END ASC,
                    bf.batch_id DESC
                  LIMIT 1
                )
                ELSE NULL
              END) as batch_squad,
              u.squad
       FROM users u
       WHERE u.id = $1`,
      [req.user.id]
    );
    const userObj = user.rows[0];
    if (userObj) {
      userObj.squad = userObj.batch_squad || userObj.squad || null;
      delete userObj.batch_squad;
    }
    res.json({ user: userObj });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateProfile = async (req, res) => {
  const { name, currentPassword, newPassword } = req.body;
  try {
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    const user = userResult.rows[0];
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required.' });
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Incorrect current password.' });
      const hashedNew = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET name = $1, password = $2 WHERE id = $3", [name || user.name, hashedNew, req.user.id]);
    } else {
      await pool.query("UPDATE users SET name = $1 WHERE id = $2", [name || user.name, req.user.id]);
    }
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const submitFeedback = async (req, res) => {
  const { feedback_text, category, additional_notes, student_id } = req.body;
  try {
    // Resolve student ID context if student or parent
    let resolvedStudentId = req.user.role === 'student' ? req.user.id : null;
    if (req.user.role === 'parent') {
      const rawChildId = student_id || req.headers['x-student-id'] || req.headers['x-selected-student-id'];
      if (rawChildId) {
        const cRes = await pool.query(
          "SELECT student_id FROM parent_students WHERE parent_id = $1 AND student_id = $2",
          [req.user.id, parseInt(rawChildId, 10)]
        );
        if (cRes.rowCount > 0) resolvedStudentId = cRes.rows[0].student_id;
      }
      if (!resolvedStudentId) {
        const cRes = await pool.query(
          "SELECT student_id FROM parent_students WHERE parent_id = $1 ORDER BY is_primary DESC, student_id ASC LIMIT 1",
          [req.user.id]
        );
        if (cRes.rowCount > 0) resolvedStudentId = cRes.rows[0].student_id;
      }
    }

    // 0. Super Admin Batch Form Lock Check (Post-LTC and Service-Trainers)
    if ((category === 'Post-LTC' || category === 'Service-Trainers') && resolvedStudentId) {
      const lockRes = await pool.query(
        `SELECT b.id, b.name,
                COALESCE((SELECT value = 'true' FROM system_settings WHERE key = 'batch_' || b.id || '_post_service_feedback_locked'), false) as is_locked
         FROM batch_students bs
         JOIN batches b ON bs.batch_id = b.id
         WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
         ORDER BY bs.batch_id DESC LIMIT 1`,
        [resolvedStudentId]
      );
      if (lockRes.rowCount > 0 && lockRes.rows[0].is_locked) {
        return res.status(403).json({
          message: 'The Service & Trainer feedback form is locked for your batch by the administrator.'
        });
      }
    }

    if (category === 'Post-LTC' && resolvedStudentId) {
      const existingRes = await pool.query(
        "SELECT id FROM feedback WHERE (user_id = $1 OR user_id = $2) AND category = 'Post-LTC'",
        [resolvedStudentId, req.user.id]
      );
      if (existingRes.rowCount === 0) {
        const studentBatchRes = await pool.query(
          `SELECT b.start_date, b.end_date 
           FROM batch_students bs 
           JOIN batches b ON bs.batch_id = b.id 
           WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL) 
           ORDER BY bs.batch_id DESC LIMIT 1`,
          [resolvedStudentId]
        );
        if (studentBatchRes.rowCount > 0) {
          const { start_date, end_date } = studentBatchRes.rows[0];
          let unlockDate = null;
          if (end_date) {
            const d = new Date(end_date);
            unlockDate = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 0, 0, 0, 0);
          } else if (start_date) {
            const d = new Date(start_date);
            unlockDate = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3, 0, 0, 0, 0);
          }

          if (unlockDate) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            if (today < unlockDate) {
              return res.status(403).json({
                message: 'Post-LTC Feedback is locked until 1 day before your batch ends.'
              });
            }
          }
        }
      }
    }

    if (category === 'Service-Trainers') {
      const checkUsers = [req.user.id];
      if (resolvedStudentId && resolvedStudentId !== req.user.id) checkUsers.push(resolvedStudentId);
      const existingRes = await pool.query(
        "SELECT id FROM feedback WHERE user_id = ANY($1::int[]) AND category = 'Service-Trainers'",
        [checkUsers]
      );
      if (existingRes.rowCount > 0) {
        return res.status(400).json({ message: 'You have already submitted the Service & Trainers Feedback Form.' });
      }

      // Ensure Overall Experience & Suggestions is provided for new submissions
      try {
        const parsed = typeof feedback_text === 'string' ? JSON.parse(feedback_text) : feedback_text;
        const suggestion = (parsed?.overall_suggestions || parsed?.overallSuggestions || '').toString().trim();
        if (!suggestion) {
          return res.status(400).json({ message: 'Overall Experience & Suggestions is required.' });
        }
      } catch (e) {
        if (!feedback_text || !feedback_text.toString().trim()) {
          return res.status(400).json({ message: 'Overall Experience & Suggestions is required.' });
        }
      }
    }

    await pool.query(
      "INSERT INTO feedback (user_id, role, feedback_text, category, additional_notes) VALUES ($1, $2, $3, $4, $5)",
      [req.user.id, req.user.role, feedback_text, category || 'General', additional_notes || null]
    );
    res.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getMyFeedbackSubmissions = async (req, res) => {
  try {
    let resolvedStudentId = req.user.role === 'student' ? req.user.id : null;
    let result;

    if (req.user.role === 'parent') {
      const rawChildId = req.headers['x-student-id'] || req.headers['x-selected-student-id'] || req.query.student_id;
      if (rawChildId) {
        const cRes = await pool.query(
          "SELECT student_id FROM parent_students WHERE parent_id = $1 AND student_id = $2",
          [req.user.id, parseInt(rawChildId, 10)]
        );
        if (cRes.rowCount > 0) resolvedStudentId = cRes.rows[0].student_id;
      }
      if (!resolvedStudentId) {
        const cRes = await pool.query(
          "SELECT student_id FROM parent_students WHERE parent_id = $1 ORDER BY is_primary DESC, student_id ASC LIMIT 1",
          [req.user.id]
        );
        if (cRes.rowCount > 0) resolvedStudentId = cRes.rows[0].student_id;
      }

      if (resolvedStudentId) {
        result = await pool.query(
          "SELECT id, feedback_text, category, additional_notes, created_at FROM feedback WHERE user_id = $1 OR user_id = $2 ORDER BY created_at DESC",
          [req.user.id, resolvedStudentId]
        );
      } else {
        result = await pool.query(
          "SELECT id, feedback_text, category, additional_notes, created_at FROM feedback WHERE user_id = $1 ORDER BY created_at DESC",
          [req.user.id]
        );
      }
    } else {
      result = await pool.query(
        "SELECT id, feedback_text, category, additional_notes, created_at FROM feedback WHERE user_id = $1 ORDER BY created_at DESC",
        [req.user.id]
      );
    }

    let postServiceFeedbackLocked = false;
    let studentBatchId = null;
    const studentToCheck = resolvedStudentId || (req.user.role === 'student' ? req.user.id : null);
    if (studentToCheck) {
      const bRes = await pool.query(
        `SELECT b.id,
                COALESCE((SELECT value = 'true' FROM system_settings WHERE key = 'batch_' || b.id || '_post_service_feedback_locked'), false) as locked
         FROM batch_students bs
         JOIN batches b ON bs.batch_id = b.id
         WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
         ORDER BY bs.batch_id DESC LIMIT 1`,
        [studentToCheck]
      );
      if (bRes.rowCount > 0) {
        studentBatchId = bRes.rows[0].id;
        postServiceFeedbackLocked = Boolean(bRes.rows[0].locked);
      }
    }

    res.json({
      submissions: result.rows,
      batch_id: studentBatchId,
      post_service_feedback_locked: postServiceFeedbackLocked
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const submitGoogleFeedbackWebhook = async (req, res) => {
  const { email, prn, category, timestamp, answers, secret } = req.body;

  // 1. Verify webhook secret
  const expectedSecret = process.env.GOOGLE_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("GOOGLE_WEBHOOK_SECRET environment variable is not configured. Webhook submissions are blocked.");
    return res.status(500).json({ message: 'Server configuration error' });
  }
  if (secret !== expectedSecret) {
    return res.status(403).json({ message: 'Forbidden: Invalid webhook secret' });
  }

  if (!email && !prn) {
    return res.status(400).json({ message: 'Bad Request: email or prn is required' });
  }

  if (!category || (category !== 'Pre-LTC' && category !== 'Post-LTC')) {
    return res.status(400).json({ message: 'Bad Request: category must be Pre-LTC or Post-LTC' });
  }

  try {
    // 2. Resolve user by email or PRN
    let userQuery = 'SELECT id, role FROM users WHERE ';
    let queryParams = [];
    if (email && prn) {
      userQuery += 'email = $1 OR prn = $2';
      queryParams = [email, prn];
    } else if (email) {
      userQuery += 'email = $1';
      queryParams = [email];
    } else {
      userQuery += 'prn = $1';
      queryParams = [prn];
    }

    const userRes = await pool.query(userQuery, queryParams);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'User not found with matching email or PRN' });
    }

    const user = userRes.rows[0];

    // Check if Post-LTC forms are locked for this student batch
    if (category === 'Post-LTC') {
      const lockRes = await pool.query(
        `SELECT b.id,
                COALESCE((SELECT value = 'true' FROM system_settings WHERE key = 'batch_' || b.id || '_post_service_feedback_locked'), false) as is_locked
         FROM batch_students bs
         JOIN batches b ON bs.batch_id = b.id
         WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
         ORDER BY bs.batch_id DESC LIMIT 1`,
        [user.id]
      );
      if (lockRes.rowCount > 0 && lockRes.rows[0].is_locked) {
        return res.status(403).json({ message: 'Post-LTC feedback form is locked for this student batch.' });
      }
    }

    // 3. Check if feedback already recorded for this category & user
    const checkRes = await pool.query(
      "SELECT id FROM feedback WHERE user_id = $1 AND category = $2",
      [user.id, category]
    );

    const feedbackText = JSON.stringify({
      isGoogleForm: true,
      timestamp: timestamp || new Date().toISOString(),
      answers: answers || {}
    });

    if (checkRes.rowCount > 0) {
      // Update existing record
      await pool.query(
        "UPDATE feedback SET feedback_text = $1, created_at = $2 WHERE user_id = $3 AND category = $4",
        [feedbackText, timestamp || new Date(), user.id, category]
      );
      return res.json({ message: `Feedback for ${category} updated successfully` });
    } else {
      // Insert new record
      await pool.query(
        "INSERT INTO feedback (user_id, role, feedback_text, category, additional_notes, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [user.id, user.role, feedbackText, category, 'Submitted via Google Form (Webhook)', timestamp || new Date()]
      );
      return res.json({ message: `Feedback for ${category} recorded successfully` });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getActiveBatch = async (req, res) => {
  try {
    // 1. Determine local today string (YYYY-MM-DD) in IST
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const yIST = nowIST.getFullYear();
    const mIST = String(nowIST.getMonth() + 1).padStart(2, '0');
    const dIST = String(nowIST.getDate()).padStart(2, '0');
    let todayStr = `${yIST}-${mIST}-${dIST}`;

    if (req.query.clientDate) {
      const clientDate = new Date(req.query.clientDate);
      if (!isNaN(clientDate.getTime())) {
        const y = clientDate.getFullYear();
        const m = String(clientDate.getMonth() + 1).padStart(2, '0');
        const d = String(clientDate.getDate()).padStart(2, '0');
        todayStr = `${y}-${m}-${d}`;
      }
    }

    // Manual status management: Background auto-updates removed per Admin control rules

    // 3. Find user's enrolled batch based on role
    let activeBatch = null;
    if (req.user && req.user.id) {
      const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [req.user.id]);
      if (userRes.rowCount > 0) {
        const role = userRes.rows[0].role;
        if (role === 'student') {
          const studentBatchRes = await pool.query(
            `SELECT b.id, b.name, b.status, b.start_date::text as start_date_str, b.end_date::text as end_date_str 
             FROM batch_students bs
             JOIN batches b ON bs.batch_id = b.id
             WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
             ORDER BY b.id DESC LIMIT 1`,
            [req.user.id]
          );
          if (studentBatchRes.rowCount > 0) {
            activeBatch = studentBatchRes.rows[0];
          }
        } else if (role === 'faculty' || role === 'ltc_member') {
          const facultyBatchRes = await pool.query(
            `SELECT b.id, b.name, b.status, b.start_date::text as start_date_str, b.end_date::text as end_date_str 
             FROM batch_faculty bf
             JOIN batches b ON bf.batch_id = b.id
             WHERE bf.faculty_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
             ORDER BY b.id DESC LIMIT 1`,
            [req.user.id]
          );
          if (facultyBatchRes.rowCount > 0) {
            activeBatch = facultyBatchRes.rows[0];
          }
        }
      }
    }

    // Fallback: If no user-specific batch was found, or user is an admin
    if (!activeBatch) {
      const globalActiveBatchRes = await pool.query(
        `SELECT id, name, status, start_date::text as start_date_str, end_date::text as end_date_str 
         FROM batches 
         WHERE (is_deleted = false OR is_deleted IS NULL) 
         ORDER BY 
           CASE WHEN status IN ('active', 'Immersion') THEN 1 
                WHEN status IN ('upcoming', 'Created', 'Planning', 'Orientation') THEN 2 
                ELSE 3 END ASC, 
           id DESC LIMIT 1`
      );
      if (globalActiveBatchRes.rowCount > 0) {
        activeBatch = globalActiveBatchRes.rows[0];
      }
    }

    if (!activeBatch) {
      return res.json({ activeBatch: null });
    }

    // 4. Calculate timezone-neutral LRP Day offset (LRP Day 1 starts 2 days after batch start date)
    let currentDay = 1;
    if (activeBatch.start_date_str) {
      const datePart = String(activeBatch.start_date_str).split('T')[0];
      const parts = datePart.split('-').map(Number);
      if (parts.length >= 3) {
        const [y, m, d] = parts;
        const lrpDay1Start = new Date(Date.UTC(y, m - 1, d + 2));

        const clientDate = new Date(todayStr + 'T00:00:00Z');
        const diffTime = clientDate.getTime() - lrpDay1Start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        let calcDay = diffDays + 1;
        if (calcDay < 1) calcDay = 1;
        if (calcDay > 3) calcDay = 3;
        currentDay = calcDay;
      }
    }

    res.json({ activeBatch, currentDay });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAnnouncementBanner = async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'banner_message'");
    const announcement = result.rowCount > 0 ? result.rows[0].value : '';
    res.json({ announcement });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    // 1. Fetch fresh user record
    const userQuery = await pool.query(
      "SELECT id, role, department, panel FROM users WHERE id = $1",
      [req.user.id]
    );
    if (userQuery.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const currentUser = userQuery.rows[0];

    if (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'read_only_superadmin') {
      // Find the active batch
      const activeBatchRes = await pool.query(
        `SELECT id FROM batches 
         WHERE status IN ('active', 'Immersion') AND (is_deleted = false OR is_deleted IS NULL) 
         ORDER BY id DESC LIMIT 1`
      );
      const activeBatchId = activeBatchRes.rowCount > 0 ? activeBatchRes.rows[0].id : null;

      let studentUndertakingSubmitted = 0;
      let studentUndertakingTotal = 0;
      let facultyUndertakingSubmitted = 0;
      let facultyUndertakingTotal = 0;
      let studentFeedbackSubmitted = 0;
      let studentPreFeedbackSubmitted = 0;
      let studentPostFeedbackSubmitted = 0;
      let facultyFeedbackSubmitted = 0;

      if (activeBatchId) {
        // Calculate based on active batch students
        const stuUndertakingRes = await pool.query(
          `SELECT 
             COUNT(*) FILTER (WHERE u.undertaking_submitted = true) as submitted_count,
             COUNT(*) as total_count
           FROM users u
           JOIN batch_students bs ON u.id = bs.student_id
           WHERE u.role = 'student' AND bs.batch_id = $1`,
          [activeBatchId]
        );
        studentUndertakingSubmitted = parseInt(stuUndertakingRes.rows[0].submitted_count || 0);
        studentUndertakingTotal = parseInt(stuUndertakingRes.rows[0].total_count || 0);

        // Calculate based on active batch faculty and LTC members assigned to squads
        const facUndertakingRes = await pool.query(
          `SELECT 
             COUNT(*) FILTER (WHERE u.undertaking_submitted = true) as submitted_count,
             COUNT(*) as total_count
           FROM users u
           JOIN batch_faculty bf ON u.id = bf.faculty_id
           WHERE (u.role = 'faculty' OR u.role = 'ltc_member') 
             AND bf.batch_id = $1
             AND bf.squad IS NOT NULL 
             AND TRIM(bf.squad) != '' 
             AND LOWER(TRIM(bf.squad)) != 'spare'`,
          [activeBatchId]
        );
        facultyUndertakingSubmitted = parseInt(facUndertakingRes.rows[0].submitted_count || 0);
        facultyUndertakingTotal = parseInt(facUndertakingRes.rows[0].total_count || 0);

        // Feedback in the active batch
        const stuFeedbackRes = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as submitted_count 
           FROM feedback 
           WHERE role = 'student' 
             AND user_id IN (
               SELECT student_id FROM batch_students WHERE batch_id = $1
             )`,
          [activeBatchId]
        );
        studentFeedbackSubmitted = parseInt(stuFeedbackRes.rows[0].submitted_count || 0);

        const stuPreFeedbackRes = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as submitted_count 
           FROM feedback 
           WHERE category = 'Pre-LTC'
             AND user_id IN (
               SELECT student_id FROM batch_students WHERE batch_id = $1
             )`,
          [activeBatchId]
        );
        studentPreFeedbackSubmitted = parseInt(stuPreFeedbackRes.rows[0].submitted_count || 0);

        const stuPostFeedbackRes = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as submitted_count 
           FROM feedback 
           WHERE category = 'Post-LTC'
             AND user_id IN (
               SELECT student_id FROM batch_students WHERE batch_id = $1
             )`,
          [activeBatchId]
        );
        studentPostFeedbackSubmitted = parseInt(stuPostFeedbackRes.rows[0].submitted_count || 0);

        const facFeedbackRes = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as submitted_count 
           FROM feedback 
           WHERE (role = 'faculty' OR role = 'ltc_member') 
             AND user_id IN (
               SELECT faculty_id FROM batch_faculty 
               WHERE batch_id = $1 
                 AND squad IS NOT NULL 
                 AND TRIM(squad) != '' 
                 AND LOWER(TRIM(squad)) != 'spare'
             )`,
          [activeBatchId]
        );
        facultyFeedbackSubmitted = parseInt(facFeedbackRes.rows[0].submitted_count || 0);
      } else {
        // Fallback: No active batch, return 0
        studentUndertakingSubmitted = 0;
        studentUndertakingTotal = 0;
        facultyUndertakingSubmitted = 0;
        facultyUndertakingTotal = 0;
        studentFeedbackSubmitted = 0;
        studentPreFeedbackSubmitted = 0;
        studentPostFeedbackSubmitted = 0;
        facultyFeedbackSubmitted = 0;
      }

      const studentUndertakingPending = Math.max(0, studentUndertakingTotal - studentUndertakingSubmitted);
      const studentUndertakingPct = studentUndertakingTotal > 0 ? Math.round((studentUndertakingSubmitted / studentUndertakingTotal) * 100) : 0;

      const facultyUndertakingPending = Math.max(0, facultyUndertakingTotal - facultyUndertakingSubmitted);
      const facultyUndertakingPct = facultyUndertakingTotal > 0 ? Math.round((facultyUndertakingSubmitted / facultyUndertakingTotal) * 100) : 0;

      const studentFeedbackTotal = studentUndertakingTotal;
      const studentFeedbackPending = Math.max(0, studentFeedbackTotal - studentFeedbackSubmitted);
      const studentFeedbackPct = studentFeedbackTotal > 0 ? Math.round((studentFeedbackSubmitted / studentFeedbackTotal) * 100) : 0;

      const studentPreFeedbackTotal = studentUndertakingTotal;
      const studentPreFeedbackPending = Math.max(0, studentPreFeedbackTotal - studentPreFeedbackSubmitted);
      const studentPreFeedbackPct = studentPreFeedbackTotal > 0 ? Math.round((studentPreFeedbackSubmitted / studentPreFeedbackTotal) * 100) : 0;

      const studentPostFeedbackTotal = studentUndertakingTotal;
      const studentPostFeedbackPending = Math.max(0, studentPostFeedbackTotal - studentPostFeedbackSubmitted);
      const studentPostFeedbackPct = studentPostFeedbackTotal > 0 ? Math.round((studentPostFeedbackSubmitted / studentPostFeedbackTotal) * 100) : 0;

      const facultyFeedbackTotal = facultyUndertakingTotal;
      const facultyFeedbackPending = Math.max(0, facultyFeedbackTotal - facultyFeedbackSubmitted);
      const facultyFeedbackPct = facultyFeedbackTotal > 0 ? Math.round((facultyFeedbackSubmitted / facultyFeedbackTotal) * 100) : 0;

      return res.json({
        studentUndertaking: {
          submitted: studentUndertakingSubmitted,
          total: studentUndertakingTotal,
          pending: studentUndertakingPending,
          pct: studentUndertakingPct
        },
        facultyUndertaking: {
          submitted: facultyUndertakingSubmitted,
          total: facultyUndertakingTotal,
          pending: facultyUndertakingPending,
          pct: facultyUndertakingPct
        },
        studentFeedback: {
          submitted: studentFeedbackSubmitted,
          total: studentFeedbackTotal,
          pending: studentFeedbackPending,
          pct: studentFeedbackPct
        },
        studentPreFeedback: {
          submitted: studentPreFeedbackSubmitted,
          total: studentPreFeedbackTotal,
          pending: studentPreFeedbackPending,
          pct: studentPreFeedbackPct
        },
        studentPostFeedback: {
          submitted: studentPostFeedbackSubmitted,
          total: studentPostFeedbackTotal,
          pending: studentPostFeedbackPending,
          pct: studentPostFeedbackPct
        },
        facultyFeedback: {
          submitted: facultyFeedbackSubmitted,
          total: facultyFeedbackTotal,
          pending: facultyFeedbackPending,
          pct: facultyFeedbackPct
        }
      });
    }

    // Faculty or LTC Member: calculate only for allocated students
    // 2. Fetch active batch and squad of the logged-in faculty/LTC
    // Resolve the currently-active batch for this faculty / LTC member
    const activeBatchRowHome = await resolveFacultyBatch(pool, currentUser.id);
    const activeBatchId = activeBatchRowHome ? activeBatchRowHome.batch_id : null;
    const squadName = activeBatchRowHome ? activeBatchRowHome.squad : null;

    let studentRows = [];
    if (currentUser.role === 'faculty') {
      if (activeBatchId && squadName) {
        const squadStudentsRes = await pool.query(
          `SELECT u.id, u.undertaking_submitted
           FROM users u
           JOIN batch_students bs ON u.id = bs.student_id
           WHERE u.role = 'student' AND bs.batch_id = $1 AND bs.squad = $2`,
          [activeBatchId, squadName]
        );
        studentRows = squadStudentsRes.rows;
      } else {
        const panels = (currentUser.panel || '').split(',').map(p => p.trim()).filter(Boolean);
        const department = currentUser.department;
        let resQuery;
        if (activeBatchId) {
          if (panels.length > 0) {
            resQuery = await pool.query(
              `SELECT u.id, u.undertaking_submitted
               FROM users u
               JOIN batch_students bs ON u.id = bs.student_id
               WHERE u.role = 'student' AND bs.batch_id = $1 AND u.panel = ANY($2)`,
              [activeBatchId, panels]
            );
          } else {
            resQuery = await pool.query(
              `SELECT u.id, u.undertaking_submitted
               FROM users u
               JOIN batch_students bs ON u.id = bs.student_id
               WHERE u.role = 'student' AND bs.batch_id = $1 AND u.department = $2`,
              [activeBatchId, department]
            );
          }
        } else {
          if (panels.length > 0) {
            resQuery = await pool.query(
              "SELECT id, undertaking_submitted FROM users WHERE role = 'student' AND panel = ANY($1)",
              [panels]
            );
          } else {
            resQuery = await pool.query(
              "SELECT id, undertaking_submitted FROM users WHERE role = 'student' AND department = $1",
              [department]
            );
          }
        }
        studentRows = resQuery.rows;
      }
    } else if (currentUser.role === 'ltc_member') {
      if (activeBatchId && squadName) {
        const squadStudentsRes = await pool.query(
          `SELECT u.id, u.undertaking_submitted
           FROM users u
           JOIN batch_students bs ON u.id = bs.student_id
           WHERE u.role = 'student' AND bs.batch_id = $1 AND bs.squad = $2`,
          [activeBatchId, squadName]
        );
        studentRows = squadStudentsRes.rows;
      }
    }

    const totalStudents = studentRows.length;
    const undertakingSubmitted = studentRows.filter(s => s.undertaking_submitted).length;
    const undertakingPending = totalStudents - undertakingSubmitted;
    const undertakingPct = totalStudents > 0 ? Math.round((undertakingSubmitted / totalStudents) * 100) : 0;

    const studentIds = studentRows.map(s => s.id);
    let feedbackSubmitted = 0;
    if (studentIds.length > 0) {
      const fbRes = await pool.query(
        "SELECT COUNT(DISTINCT user_id) as submitted_count FROM feedback WHERE role = 'student' AND user_id = ANY($1)",
        [studentIds]
      );
      feedbackSubmitted = parseInt(fbRes.rows[0].submitted_count || 0);
    }
    const feedbackPending = Math.max(0, totalStudents - feedbackSubmitted);
    const feedbackPct = totalStudents > 0 ? Math.round((feedbackSubmitted / totalStudents) * 100) : 0;

    return res.json({
      studentUndertaking: {
        submitted: undertakingSubmitted,
        total: totalStudents,
        pending: undertakingPending,
        pct: undertakingPct
      },
      studentFeedback: {
        submitted: feedbackSubmitted,
        total: totalStudents,
        pending: feedbackPending,
        pct: feedbackPct
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const testEmail = async (req, res) => {
  const { to } = req.query;
  const recipient = to || 'ahsanimamkhan06@gmail.com';

  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #334155; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">AWS SES Integration Test</h2>
      <p>Hello,</p>
      <p>This is a sample HTML email sent via the newly integrated <strong>Amazon Simple Email Service (SES)</strong> on your Node.js + Express backend.</p>
      <p>If you are reading this message, the integration is working successfully!</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b;">Sender: ${process.env.SES_FROM_EMAIL || 'not configured'} | Region: ${process.env.AWS_REGION || 'ap-south-1'}</p>
    </div>
  `;

  try {
    const { sendEmail } = require('../services/emailService');
    const response = await sendEmail({
      to: recipient,
      subject: 'AWS SES Test Email - Success',
      html,
      text: 'This is a test email sent via AWS SES integration.'
    });
    res.json({ message: 'Test email sent successfully', messageId: response.messageId, recipient });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send test email', error: err.message });
  }
};

const raiseTicket = async (req, res) => {
  const { subject, description, category, priority, on_behalf_of, screenshot, student_id } = req.body;
  if (!subject || !description) {
    return res.status(400).json({ message: 'Subject and description are required.' });
  }
  try {
    let finalOnBehalfOf = on_behalf_of || null;
    let targetStudentId = req.user.id;

    if (req.user.role === 'parent') {
      const rawChildId = student_id || req.headers['x-student-id'] || req.headers['x-selected-student-id'];
      let selectedChild = null;

      if (rawChildId) {
        const cRes = await pool.query(
          `SELECT u.id, u.name, u.prn, u.email 
           FROM parent_students ps
           JOIN users u ON ps.student_id = u.id
           WHERE ps.parent_id = $1 AND ps.student_id = $2`,
          [req.user.id, parseInt(rawChildId, 10)]
        );
        if (cRes.rowCount > 0) {
          selectedChild = cRes.rows[0];
        } else {
          return res.status(403).json({ message: 'Access denied: You are not authorized to raise tickets for this student.' });
        }
      } else {
        const childrenRes = await pool.query(
          `SELECT u.id, u.name, u.prn, u.email 
           FROM parent_students ps
           JOIN users u ON ps.student_id = u.id
           WHERE ps.parent_id = $1
           ORDER BY ps.is_primary DESC, ps.student_id ASC`,
          [req.user.id]
        );
        if (childrenRes.rowCount > 0) {
          selectedChild = childrenRes.rows[0];
        }
      }

      if (selectedChild) {
        targetStudentId = selectedChild.id;
        if (!finalOnBehalfOf) {
          finalOnBehalfOf = `${selectedChild.name}${selectedChild.prn ? ` (${selectedChild.prn})` : ''}`;
        }
      }
    }

    const insertRes = await pool.query(
      "INSERT INTO tickets (user_id, subject, description, category, priority, on_behalf_of, screenshot) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at",
      [req.user.id, subject, description, category || 'Problem', priority || 'Medium', finalOnBehalfOf, screenshot || null]
    );
    const createdTicket = insertRes.rows[0];
    const ticketId = createdTicket ? createdTicket.id : null;

    // Send automated email notification to designated admin inboxes (non-blocking)
    if (ticketId) {
      pool.query("SELECT name, email, role, prn FROM users WHERE id = $1", [req.user.id])
        .then(userRes => {
          const raiser = userRes.rows[0] || {};
          return sendNewTicketNotifications({
            ticketId,
            userName: raiser.name || req.user.name,
            userRole: raiser.role || req.user.role,
            userEmail: raiser.email || req.user.email,
            category: category || 'Problem',
            priority: priority || 'Medium',
            subject,
            description,
            onBehalfOf: finalOnBehalfOf,
            createdAt: createdTicket.created_at || new Date()
          });
        })
        .catch(err => {
          console.error('[Ticket Notification Error] Failed to send new ticket email:', err.message);
        });
    }

    // 1. Notify all admins and superadmins
    const adminRes = await pool.query("SELECT id FROM users WHERE role = 'admin' OR role = 'superadmin'");
    for (const admin of adminRes.rows) {
      await createSystemNotification(
        admin.id,
        'New Support Ticket Raised',
        `A new ticket "${subject}" has been raised by a user (${category} - ${priority} priority).`,
        'info',
        req.user.id
      );
    }

    // 2. Notify the creator (self-notification)
    await createSystemNotification(
      req.user.id,
      'Support Ticket Raised',
      `Your support ticket "${subject}" has been raised successfully.`,
      'info',
      req.user.id
    );

    // 3. Notify the user if raised on behalf of someone else
    if (finalOnBehalfOf && req.user.role !== 'parent') {
      const matchObh = await pool.query(
        "SELECT id, name FROM users WHERE email = $1 OR prn = $1 OR name = $1",
        [finalOnBehalfOf]
      );
      if (matchObh.rowCount > 0) {
        targetStudentId = matchObh.rows[0].id;
      }
    }

    if (targetStudentId && targetStudentId !== req.user.id) {
      await createSystemNotification(
        targetStudentId,
        'Support Ticket Raised On Your Behalf',
        `A support ticket "${subject}" has been raised on your behalf by ${req.user.name || 'a family member / coordinator'}.`,
        'info',
        req.user.id
      );
    }

    // 4. Notify squad faculty members of the target student
    if (targetStudentId) {
      const squadRes = await pool.query(
        `SELECT bs.batch_id, bs.squad FROM batch_students bs
         WHERE bs.student_id = $1`,
        [targetStudentId]
      );
      if (squadRes.rowCount > 0) {
        const { batch_id, squad } = squadRes.rows[0];
        if (squad) {
          const facultyRes = await pool.query(
            `SELECT faculty_id FROM batch_faculty 
             WHERE batch_id = $1 AND squad = $2`,
            [batch_id, squad]
          );
          for (const f of facultyRes.rows) {
            await createSystemNotification(
              f.faculty_id,
              'Squad Member Ticket Raised',
              `A support ticket "${subject}" has been raised by/on behalf of your squad member.`,
              'info',
              req.user.id
            );
          }
        }
      }
    }

    res.json({ message: 'Ticket raised successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getMyTickets = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'parent') {
      const childRes = await pool.query(
        "SELECT student_id FROM parent_students WHERE parent_id = $1",
        [req.user.id]
      );
      const childIds = childRes.rows.map(r => r.student_id);

      result = await pool.query(
        `SELECT t.id, t.subject, t.description, t.status, t.resolution, t.resolved_at, t.created_at,
                t.category, t.priority, t.on_behalf_of, t.screenshot,
                u.name as resolver_name
         FROM tickets t
         LEFT JOIN users u ON t.resolved_by = u.id
         WHERE t.user_id = $1
            OR (t.user_id = ANY($2::int[]) AND $2::int[] IS NOT NULL)
         ORDER BY t.created_at DESC`,
        [req.user.id, childIds.length > 0 ? childIds : []]
      );
    } else if (req.user.role === 'student') {
      result = await pool.query(
        `SELECT t.id, t.subject, t.description, t.status, t.resolution, t.resolved_at, t.created_at,
                t.category, t.priority, t.on_behalf_of, t.screenshot,
                u.name as resolver_name
         FROM tickets t
         LEFT JOIN users u ON t.resolved_by = u.id
         WHERE t.user_id = $1
            OR (t.user_id IN (SELECT parent_id FROM parent_students WHERE student_id = $1))
         ORDER BY t.created_at DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT t.id, t.subject, t.description, t.status, t.resolution, t.resolved_at, t.created_at,
                t.category, t.priority, t.on_behalf_of, t.screenshot,
                u.name as resolver_name
         FROM tickets t
         LEFT JOIN users u ON t.resolved_by = u.id
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC`,
        [req.user.id]
      );
    }
    res.json({ tickets: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAllTickets = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.user_id, t.subject, t.description, t.status, t.resolution, t.resolved_at, t.created_at,
              t.category, t.priority, t.on_behalf_of,
              CASE WHEN t.screenshot IS NOT NULL AND TRIM(t.screenshot) != '' THEN true ELSE false END as has_screenshot,
              t.screenshot,
              u.name as creator_name, u.email as creator_email, u.role as creator_role, u.prn as creator_prn, u.faculty_id as creator_faculty_id,
              r.name as resolver_name,
              COALESCE(
                (SELECT s.squad FROM batch_students s JOIN batches b ON s.batch_id = b.id WHERE s.student_id = u.id ORDER BY (b.status IN ('active', 'Immersion')) DESC, b.id DESC LIMIT 1),
                (SELECT f.squad FROM batch_faculty f JOIN batches b ON f.batch_id = b.id WHERE f.faculty_id = u.id ORDER BY (b.status IN ('active', 'Immersion')) DESC, b.id DESC LIMIT 1)
              ) as squad_name,
              COALESCE(
                (SELECT s.batch_id FROM batch_students s JOIN batches b ON s.batch_id = b.id WHERE s.student_id = u.id ORDER BY (b.status IN ('active', 'Immersion')) DESC, b.id DESC LIMIT 1),
                (SELECT f.batch_id FROM batch_faculty f JOIN batches b ON f.batch_id = b.id WHERE f.faculty_id = u.id ORDER BY (b.status IN ('active', 'Immersion')) DESC, b.id DESC LIMIT 1)
              ) as batch_id,
              COALESCE(
                (SELECT b.name FROM batch_students s JOIN batches b ON s.batch_id = b.id WHERE s.student_id = u.id ORDER BY (b.status IN ('active', 'Immersion')) DESC, b.id DESC LIMIT 1),
                (SELECT b.name FROM batch_faculty f JOIN batches b ON f.batch_id = b.id WHERE f.faculty_id = u.id ORDER BY (b.status IN ('active', 'Immersion')) DESC, b.id DESC LIMIT 1)
              ) as batch_name
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN users r ON t.resolved_by = r.id
       ORDER BY t.created_at DESC`
    );
    res.json({ tickets: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const resolveTicket = async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body;
  if (!resolution || !resolution.trim()) {
    return res.status(400).json({ message: 'Resolution details are required.' });
  }
  try {
    const ticketCheck = await pool.query(
      `SELECT t.*, u.name as raiser_name, u.email as raiser_email, u.role as raiser_role
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [id]
    );
    if (ticketCheck.rowCount === 0) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    const ticket = ticketCheck.rows[0];
    if (ticket.status === 'resolved') {
      return res.status(400).json({ message: 'This ticket has already been resolved.' });
    }

    const trimmedResolution = resolution.trim();
    const updateRes = await pool.query(
      `UPDATE tickets 
       SET status = 'resolved', resolution = $1, resolved_by = $2, resolved_at = NOW()
       WHERE id = $3
       RETURNING resolved_at`,
      [trimmedResolution, req.user.id, id]
    );
    const resolvedAt = updateRes.rows[0]?.resolved_at || new Date();

    // 1. Notify the ticket creator via in-app system notification
    await createSystemNotification(
      ticket.user_id,
      'Support Ticket Resolved',
      `Your support ticket "${ticket.subject}" has been resolved.\nResolution: ${trimmedResolution}`,
      'info',
      req.user.id
    );

    // 2. Automated email notification to the original ticket raiser (non-blocking)
    // Always sent from no-reply@mitwpultc.in without exposing admin personal details
    sendTicketResolvedNotification({
      ticketId: ticket.id,
      raiserName: ticket.raiser_name,
      raiserEmail: ticket.raiser_email,
      subject: ticket.subject,
      description: ticket.description,
      resolution: trimmedResolution,
      resolvedAt
    }).catch(err => {
      console.error('[Ticket Notification Error] Failed to send ticket resolved email:', err.message);
    });

    // 2. Notify the user if raised on behalf of someone else
    let targetStudentId = ticket.user_id;
    if (ticket.on_behalf_of) {
      const matchObh = await pool.query(
        "SELECT id FROM users WHERE email = $1 OR prn = $1 OR name = $1",
        [ticket.on_behalf_of]
      );
      if (matchObh.rowCount > 0) {
        targetStudentId = matchObh.rows[0].id;
        await createSystemNotification(
          targetStudentId,
          'Support Ticket Resolved',
          `A support ticket raised on your behalf ("${ticket.subject}") has been resolved.\nResolution: ${resolution}`,
          'info',
          req.user.id
        );
      }
    }

    // 3. Notify squad faculty members of the student
    const squadRes = await pool.query(
      `SELECT bs.batch_id, bs.squad FROM batch_students bs
       WHERE bs.student_id = $1`,
      [targetStudentId]
    );
    if (squadRes.rowCount > 0) {
      const { batch_id, squad } = squadRes.rows[0];
      if (squad) {
        const facultyRes = await pool.query(
          `SELECT faculty_id FROM batch_faculty 
           WHERE batch_id = $1 AND squad = $2`,
          [batch_id, squad]
        );
        for (const f of facultyRes.rows) {
          await createSystemNotification(
            f.faculty_id,
            'Squad Member Ticket Resolved',
            `A support ticket raised by/on behalf of your squad member ("${ticket.subject}") has been resolved.`,
            'info',
            req.user.id
          );
        }
      }
    }

    res.json({ message: 'Ticket marked as resolved.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getTranslations = async (req, res) => {
  try {
    const result = await pool.query("SELECT key, hi, mr FROM translations");
    const hi = {};
    const mr = {};
    result.rows.forEach(row => {
      hi[row.key] = row.hi || '';
      mr[row.key] = row.mr || '';
    });
    res.status(200).json({
      success: true,
      translations: { hi, mr }
    });
  } catch (err) {
    console.error('Error fetching translations:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

const getMyCertificates = async (req, res) => {
  const userId = req.user.id;
  try {
    let targetStudentId = userId;
    if (req.user.role === 'parent') {
      const rawChildId = req.headers['x-student-id'] || req.headers['x-selected-student-id'] || req.query.student_id || req.query.childId;
      if (rawChildId) {
        const parsed = parseInt(rawChildId, 10);
        const check = await pool.query(
          "SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2",
          [req.user.id, parsed]
        );
        if (check.rowCount > 0) {
          targetStudentId = parsed;
        } else {
          return res.status(403).json({ message: 'Access denied: You are not authorized to view certificates for this student.' });
        }
      } else {
        const children = await pool.query(
          "SELECT student_id FROM parent_students WHERE parent_id = $1 ORDER BY is_primary DESC, student_id ASC LIMIT 1",
          [req.user.id]
        );
        if (children.rowCount > 0) {
          targetStudentId = children.rows[0].student_id;
        } else {
          return res.json({ certificates: [] });
        }
      }
    }

    // If student or parent, check if they filled service trainee feedback
    if (req.user.role === 'student' || req.user.role === 'parent') {
      const feedbackCheck = await pool.query(
        "SELECT 1 FROM feedback WHERE (user_id = $1 OR user_id = $2) AND category = 'Service-Trainers' LIMIT 1",
        [targetStudentId, req.user.id]
      );
      if (feedbackCheck.rowCount === 0) {
        return res.json({ certificates: [] });
      }
    }

    const result = await pool.query(
      `SELECT * FROM certificates WHERE student_id = $1 ORDER BY issued_at DESC`,
      [targetStudentId]
    );
    const certs = result.rows.map(r => {
      let data = r.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { }
      }
      return { ...r, data };
    });
    res.json({ certificates: certs });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const downloadCertificate = async (req, res) => {
  const { id } = req.params;
  const token = req.query.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).send('Unauthorized: No token provided');
  }

  try {
    // 1. Verify token
    if (!process.env.JWT_SECRET) {
      console.error('CRITICAL: JWT_SECRET environment variable is missing.');
      return res.status(500).send('Server configuration error');
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).send('Unauthorized: Invalid token');
    }

    // 2. Fetch certificate, user name, and batch dates
    const certQuery = await pool.query(
      `SELECT c.*, u.name as student_name, u.prn as student_prn, u.role as student_role,
              b.start_date::text as start_date_str, b.end_date::text as end_date_str
       FROM certificates c
       JOIN users u ON c.student_id = u.id
       JOIN batches b ON c.batch_id = b.id
       WHERE c.id = $1`,
      [parseInt(id)]
    );

    if (certQuery.rowCount === 0) {
      return res.status(404).send('Certificate not found');
    }

    const cert = certQuery.rows[0];

    // 3. Authorization check
    // The requesting user must be the student of the certificate OR an admin/superadmin OR a verified parent of the student
    let isAuthorized = false;
    if (
      decoded.role === 'superadmin' ||
      decoded.role === 'superadmin_readonly' ||
      decoded.role === 'admin' ||
      parseInt(decoded.id) === parseInt(cert.student_id)
    ) {
      isAuthorized = true;
    } else if (decoded.role === 'parent') {
      const parentCheck = await pool.query(
        "SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2",
        [decoded.id, cert.student_id]
      );
      if (parentCheck.rowCount > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).send('Forbidden: Access denied');
    }

    // Check if service trainee feedback has been completed
    if (decoded.role === 'student' || decoded.role === 'parent') {
      const feedbackCheck = await pool.query(
        "SELECT 1 FROM feedback WHERE (user_id = $1 OR user_id = $2) AND category = 'Service-Trainers' LIMIT 1",
        [cert.student_id, decoded.id]
      );
      if (feedbackCheck.rowCount === 0) {
        return res.status(403).send('Forbidden: Service & Trainee feedback must be completed to download certificates.');
      }
    }

    let data = cert.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { }
    }

    // 4. If it's a category certificate, compile it dynamically
    if (data && (data.is_category || cert.type !== 'completion')) {
      const templateFileName = data.template;
      if (!templateFileName) {
        return res.status(400).send('Certificate template missing');
      }

      const templatePath = path.join(__dirname, '../certificates', templateFileName);
      const fontBoldPath = path.join(__dirname, '../../frontend/public/fonts/Poppins-Bold.ttf');
      const fontRegularPath = path.join(__dirname, '../../frontend/public/fonts/Poppins-Regular.ttf');
      const fontMediumPath = path.join(__dirname, '../../frontend/public/fonts/Poppins-Medium.ttf');

      if (!fs.existsSync(templatePath)) {
        return res.status(404).send(`Template file ${templateFileName} not found on server`);
      }

      if (!fs.existsSync(fontBoldPath) || !fs.existsSync(fontRegularPath) || !fs.existsSync(fontMediumPath)) {
        return res.status(500).send('Server fonts configuration error');
      }

      const arrayBuffer = fs.readFileSync(templatePath);
      const sourceDoc = await PDFDocument.load(arrayBuffer);
      const [sourcePage] = sourceDoc.getPages();

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const A4_W = 595.2756;
      const A4_H = 841.8898;
      const page = pdfDoc.addPage([A4_W, A4_H]);

      const [embeddedPage] = await pdfDoc.embedPages([sourcePage]);

      const scale = 0.94;
      const drawWidth = A4_W * scale;
      const drawHeight = A4_H * scale;
      const dx = (A4_W - drawWidth) / 2;
      const dy = (A4_H - drawHeight) / 2;

      page.drawPage(embeddedPage, {
        x: dx,
        y: dy,
        width: drawWidth,
        height: drawHeight
      });

      const poppinsBold = await pdfDoc.embedFont(fs.readFileSync(fontBoldPath));
      const poppinsRegular = await pdfDoc.embedFont(fs.readFileSync(fontRegularPath));
      const poppinsMedium = await pdfDoc.embedFont(fs.readFileSync(fontMediumPath));

      const formatBatchDates = (startStr, endStr) => {
        try {
          if (!startStr || !endStr) {
            return "19th to 23rd April 2026.";
          }
          const dStart = new Date(startStr);
          const dEnd = new Date(endStr);
          if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
            return "19th to 23rd April 2026.";
          }
          const getOrdinal = (d) => {
            if (d > 3 && d < 21) return 'th';
            switch (d % 10) {
              case 1: return "st";
              case 2: return "nd";
              case 3: return "rd";
              default: return "th";
            }
          };

          const startDay = dStart.getDate();
          const startOrd = getOrdinal(startDay);
          const endDay = dEnd.getDate();
          const endOrd = getOrdinal(endDay);

          const startMonth = dStart.toLocaleDateString('en-US', { month: 'long' });
          const endMonth = dEnd.toLocaleDateString('en-US', { month: 'long' });
          const startYear = dStart.getFullYear();
          const endYear = dEnd.getFullYear();

          if (dStart.toDateString() === dEnd.toDateString()) {
            return `${startDay}${startOrd} ${startMonth} ${startYear}.`;
          }

          if (startYear !== endYear) {
            return `${startDay}${startOrd} ${startMonth} ${startYear} to ${endDay}${endOrd} ${endMonth} ${endYear}.`;
          } else if (startMonth !== endMonth) {
            return `${startDay}${startOrd} ${startMonth} to ${endDay}${endOrd} ${endMonth} ${startYear}.`;
          } else {
            return `${startDay}${startOrd} to ${endDay}${endOrd} ${startMonth} ${startYear}.`;
          }
        } catch {
          return "19th to 23rd April 2026.";
        }
      };

      const dateText = formatBatchDates(cert.start_date_str, cert.end_date_str);

      // Draw Student Name
      const rawName = cert.student_name || 'Student';
      const fullName = rawName.replace(/^(mr\.|ms\.|mrs\.|dr\.|prof\.|shri\.|smt\.|mr|ms|mrs|dr|prof|shri|smt)\s+/i, '').trim();
      let nameSize = 19 * scale;
      let nameWidth = poppinsMedium.widthOfTextAtSize(fullName, nameSize);
      while (nameWidth > (400 * scale) && nameSize > (12 * scale)) {
        nameSize -= 0.5 * scale;
        nameWidth = poppinsMedium.widthOfTextAtSize(fullName, nameSize);
      }
      const nameX = (A4_W / 2) - (nameWidth / 2);
      const nameY = dy + 512 * scale;

      page.drawText(fullName, {
        x: nameX,
        y: nameY,
        size: nameSize,
        font: poppinsMedium,
        color: rgb(0.06, 0.05, 0.17)
      });

      // Cover old date placeholder and draw dynamic batch dates (perfectly aligned with dotted line at Y=318.5)
      page.drawRectangle({
        x: dx + 258 * scale,
        y: dy + 316 * scale,
        width: 250 * scale,
        height: 12 * scale,
        color: rgb(1, 1, 1)
      });

      const datesSize = 13.5 * scale;
      const datesX = dx + 258 * scale;
      const datesY = dy + 318.5 * scale;
      page.drawText(dateText, {
        x: datesX,
        y: datesY,
        size: datesSize,
        font: poppinsRegular,
        color: rgb(0.06, 0.05, 0.17)
      });

      // Get dynamic LTC ID
      const students = await withLtcId([{ id: cert.student_id, prn: cert.student_prn }]);
      const ltcId = students[0]?.ltc_id;

      // Draw LTC ID in top right
      if (ltcId) {
        const ltcText = `LTC ID: ${ltcId}`;
        const ltcSize = 8.5;
        const ltcWidth = poppinsRegular.widthOfTextAtSize(ltcText, ltcSize);
        const ltcX = A4_W - ltcWidth - 35;
        const ltcY = A4_H - 30;
        page.drawText(ltcText, {
          x: ltcX,
          y: ltcY,
          size: ltcSize,
          font: poppinsRegular,
          color: rgb(0.06, 0.05, 0.17)
        });
      }

      // Draw LTC ID at bottom center
      if (ltcId) {
        const ltcIdText = `LTC ID: ${ltcId}`;
        const ltcIdSize = 10 * scale;
        const ltcIdWidth = poppinsRegular.widthOfTextAtSize(ltcIdText, ltcIdSize);
        const ltcIdX = (A4_W / 2) - (ltcIdWidth / 2);
        const ltcIdY = dy + 70 * scale;
        page.drawText(ltcIdText, {
          x: ltcIdX,
          y: ltcIdY,
          size: ltcIdSize,
          font: poppinsRegular,
          color: rgb(0.06, 0.05, 0.17)
        });
      }

      const pdfBytes = await pdfDoc.save();
      const filename = `Certificate_${fullName.trim().replace(/\s+/g, '_')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(pdfBytes));
    }

    // 5. If it's a custom uploaded certificate, serve it accordingly
    if (data && data.url) {
      const url = data.url;
      if (url.startsWith('data:')) {
        const matches = url.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const contentType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          res.setHeader('Content-Type', contentType);
          const ext = contentType.split('/')[1] || 'pdf';
          res.setHeader('Content-Disposition', `attachment; filename="Certificate_${cert.id}.${ext}"`);
          return res.send(buffer);
        }
      }
      if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
        const relativePath = url.startsWith('/') ? url.substring(1) : url;
        const filePath = path.join(__dirname, '..', relativePath);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }
      return res.redirect(url);
    }

    return res.status(400).send('No certificate URL or template data found.');
  } catch (err) {
    console.error('Error downloading certificate:', err);
    res.status(500).send('Server error generating certificate');
  }
};

module.exports = {
  serveMediaFile,
  getMyCertificates,
  downloadCertificate,
  verifyBarcode,
  uploadDocument,
  deleteDocument,
  getDocuments,
  getSchedules,
  getProfile,
  updateProfile,
  submitFeedback,
  getMyFeedbackSubmissions,
  submitGoogleFeedbackWebhook,
  getActiveBatch,
  getAnnouncementBanner,
  getDashboardStats,
  testEmail,
  raiseTicket,
  getMyTickets,
  getAllTickets,
  resolveTicket,
  getTranslations
};
