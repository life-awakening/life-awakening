const pool = require('../config/db');
const XLSX = require('xlsx');
const { logRiAction } = require('../utils/riAudit');

/**
 * Valid categories for Orange Flags
 */
const VALID_CATEGORIES = [
  'Minor Injury',
  'Physical Discomfort',
  'Health Concern',
  'Safety Concern',
  'Other Non-Critical Incident'
];

/**
 * Valid statuses for Orange Flags lifecycle
 */
const VALID_STATUSES = ['open', 'under_follow_up', 'resolved'];

/**
 * Helper: Resolve Faculty Panel/Batch Scope
 */
function getFacultyScopeArrays(req) {
  const isPreview = req.isRiAdminPreview || req.user?.role === 'superadmin' || req.user?.role === 'superadmin-ri' || req.user?.role === 'ri_admin';
  const assignedBatchIds = req.assignedBatchIds || req.activeBatchIds || [];
  const assignedPanelIds = req.assignedPanelIds || [];

  return {
    isPreview,
    assignedBatchIds,
    assignedPanelIds
  };
}

/**
 * 1. Get Eligible Students for Faculty Orange Flag Dropdown
 * Returns ONLY students assigned to the faculty's authorized panel(s) and batch(es).
 */
exports.getFacultyStudents = async (req, res) => {
  try {
    const { isPreview, assignedBatchIds, assignedPanelIds } = getFacultyScopeArrays(req);

    let query = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.email as student_email,
        u.prn as student_prn,
        u.department,
        u.school,
        u.phone,
        rbs.ri_batch_id,
        rbs.ri_panel_id,
        rb.name as batch_name,
        rp.name as panel_name,
        rp.panel_number,
        rv.name as village_name
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
    `;

    const params = [];
    const whereClauses = ["rb.status <> 'deleted'"];

    if (!isPreview) {
      if (assignedPanelIds.length === 0) {
        return res.json({ success: true, students: [] });
      }
      params.push(assignedPanelIds);
      whereClauses.push(`rbs.ri_panel_id = ANY($${params.length}::int[])`);

      if (assignedBatchIds.length > 0) {
        params.push(assignedBatchIds);
        whereClauses.push(`rbs.ri_batch_id = ANY($${params.length}::int[])`);
      }
    }

    if (req.query.panel_id) {
      params.push(parseInt(req.query.panel_id, 10));
      whereClauses.push(`rbs.ri_panel_id = $${params.length}`);
    }
    if (req.query.batch_id) {
      params.push(parseInt(req.query.batch_id, 10));
      whereClauses.push(`rbs.ri_batch_id = $${params.length}`);
    }

    query += ` WHERE ${whereClauses.join(' AND ')} ORDER BY rp.panel_number ASC, u.name ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      students: result.rows
    });
  } catch (err) {
    console.error('[RI Orange Flag] Error fetching faculty students:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving students list.' });
  }
};

/**
 * 2. Report an Orange Flag Incident (Faculty Only)
 * Backend strictly validates that target student belongs to faculty's authorized panel/batch.
 */
exports.reportFacultyOrangeFlag = async (req, res) => {
  try {
    const {
      student_id,
      category,
      description,
      incident_date_time,
      action_taken,
      follow_up_required = true,
      follow_up_notes,
      additional_info
    } = req.body;

    const parsedStudentId = parseInt(student_id, 10);
    if (!parsedStudentId) {
      return res.status(400).json({ success: false, message: 'Please select a valid student from your assigned panel.' });
    }

    // Category validation
    const matchedCategory = VALID_CATEGORIES.find(
      c => c.toLowerCase() === (category || '').trim().toLowerCase()
    );
    if (!matchedCategory) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    // Description validation
    const cleanDesc = (description || '').trim();
    if (!cleanDesc) {
      return res.status(400).json({ success: false, message: 'Please provide a clear description for this incident.' });
    }

    // Date/time handling
    let incidentDate = new Date();
    if (incident_date_time) {
      const parsedDate = new Date(incident_date_time);
      if (!isNaN(parsedDate.getTime())) {
        incidentDate = parsedDate;
      }
    }

    const { isPreview, assignedBatchIds, assignedPanelIds } = getFacultyScopeArrays(req);

    // Verify student exists and get assignment details
    const studentQuery = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.email as student_email,
        u.prn as student_prn,
        u.department,
        u.school,
        rbs.ri_batch_id,
        rbs.ri_panel_id,
        rb.name as batch_name,
        rp.name as panel_name,
        rv.name as village_name
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE u.id = $1
    `;
    const sRes = await pool.query(studentQuery, [parsedStudentId]);

    if (sRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Student is not enrolled in any active RI cohort.' });
    }

    const sData = sRes.rows[0];

    // Backend scope enforcement
    if (!isPreview) {
      if (!assignedPanelIds.includes(sData.ri_panel_id)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: You are only allowed to report incidents for students within your assigned panel.'
        });
      }
      if (assignedBatchIds.length > 0 && !assignedBatchIds.includes(sData.ri_batch_id)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Student does not belong to your active cohort batch.'
        });
      }
    }

    // Resolve reporting faculty identity
    let facultyId = req.user?.id || null;
    if (facultyId) {
      const uExists = await pool.query('SELECT id FROM users WHERE id = $1', [facultyId]);
      if (uExists.rowCount === 0) facultyId = null;
    }
    let facultyName = req.user?.name || req.userEmail || 'Faculty Mentor';
    let facultyEmail = req.userEmail || req.user?.email || '';

    if (req.facultyAssignments && req.facultyAssignments.length > 0) {
      facultyName = req.facultyAssignments[0].faculty_name || facultyName;
      facultyEmail = req.facultyAssignments[0].faculty_email || facultyEmail;
    }

    const cleanupUploadedFile = () => {
      if (req.file) {
        const fs = require('fs');
        try { fs.unlinkSync(req.file.path); } catch {}
      }
    };

    // Duplicate check: prevent rapid accidental double-submission (same student, same category, open within last 30 minutes)
    const dupCheck = await pool.query(`
      SELECT id, status, created_at 
      FROM ri_orange_flags 
      WHERE student_id = $1 
        AND ri_batch_id = $2 
        AND category = $3 
        AND status IN ('open', 'under_follow_up')
        AND created_at > NOW() - INTERVAL '30 minutes'
    `, [parsedStudentId, sData.ri_batch_id, matchedCategory]);

    if (dupCheck.rowCount > 0) {
      cleanupUploadedFile();
      return res.status(400).json({
        success: false,
        message: `An active "${matchedCategory}" orange flag was already submitted recently for ${sData.student_name}. Please update the existing incident or add a follow-up note.`
      });
    }

    const initialStatus = 'open';
    const isFollowUpReq = Boolean(follow_up_required);

    const medicalReportUrl = req.file
      ? `/uploads/ri_medical_reports/${req.file.filename}`
      : (req.body.medical_report_url || null);
    const medicalReportName = req.file
      ? req.file.originalname
      : (req.body.medical_report_name || null);
    const medicalReportSize = req.file
      ? req.file.size
      : (req.body.medical_report_size ? parseInt(req.body.medical_report_size, 10) : null);

    // Insert new Orange Flag record
    const insertRes = await pool.query(`
      INSERT INTO ri_orange_flags (
        student_id,
        student_name,
        student_email,
        student_prn,
        department,
        school,
        ri_batch_id,
        ri_panel_id,
        batch_name,
        panel_name,
        village_name,
        faculty_id,
        faculty_name,
        faculty_email,
        category,
        description,
        incident_date_time,
        action_taken,
        follow_up_required,
        additional_info,
        medical_report_url,
        medical_report_name,
        medical_report_size,
        status,
        last_updated_by,
        last_updated_by_name,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW())
      RETURNING *
    `, [
      parsedStudentId,
      sData.student_name,
      sData.student_email,
      sData.student_prn,
      sData.department,
      sData.school,
      sData.ri_batch_id,
      sData.ri_panel_id,
      sData.batch_name,
      sData.panel_name,
      sData.village_name,
      facultyId,
      facultyName,
      facultyEmail,
      matchedCategory,
      cleanDesc,
      incidentDate,
      action_taken ? action_taken.trim() : null,
      isFollowUpReq,
      additional_info ? additional_info.trim() : null,
      medicalReportUrl,
      medicalReportName,
      medicalReportSize,
      initialStatus,
      facultyId,
      facultyName
    ]);

    const createdFlag = insertRes.rows[0];

    // Record creation history entry
    const initialNote = follow_up_notes ? follow_up_notes.trim() : 'Incident reported and marked as Orange Flag.';
    await pool.query(`
      INSERT INTO ri_orange_flag_history (
        flag_id,
        user_id,
        user_name,
        user_role,
        action,
        previous_status,
        new_status,
        notes,
        created_at
      ) VALUES ($1, $2, $3, $4, 'CREATED', NULL, $5, $6, NOW())
    `, [
      createdFlag.id,
      facultyId,
      facultyName,
      req.user?.role || 'faculty',
      initialStatus,
      initialNote
    ]);

    // Send notification to Admin / SuperAdmin
    try {
      await pool.query(`
        INSERT INTO ri_notifications (
          title,
          message,
          type,
          target_role,
          metadata,
          created_at
        ) VALUES ($1, $2, 'orange_flag', 'admin', $3, NOW())
      `, [
        `Orange Flag: ${matchedCategory} (${sData.student_name})`,
        `Faculty ${facultyName} reported an Orange Flag (${matchedCategory}) for student ${sData.student_name} (PRN: ${sData.student_prn || 'N/A'}, Panel: ${sData.panel_name}).`,
        JSON.stringify({
          orange_flag_id: createdFlag.id,
          student_id: parsedStudentId,
          category: matchedCategory,
          panel_name: sData.panel_name,
          batch_name: sData.batch_name,
          medical_report_url: medicalReportUrl || null
        })
      ]);
    } catch (notifErr) {
      console.warn('[RI Orange Flag] Notification insert warning:', notifErr.message);
    }

    // Log to RI Audit Trail
    await logRiAction(pool, {
      userId: facultyId,
      userEmail: facultyEmail,
      userName: facultyName,
      userRole: req.user?.role || 'faculty',
      action: 'REPORT_ORANGE_FLAG',
      batchId: sData.ri_batch_id,
      panelId: sData.ri_panel_id,
      studentId: parsedStudentId,
      recordId: createdFlag.id,
      details: {
        category: matchedCategory,
        student_name: sData.student_name,
        student_prn: sData.student_prn,
        panel_name: sData.panel_name,
        medical_report: medicalReportName || null
      }
    });

    res.status(201).json({
      success: true,
      message: `Orange flag successfully reported for ${sData.student_name}.`,
      orangeFlag: createdFlag
    });
  } catch (err) {
    if (req.file) {
      const fs = require('fs');
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('[RI Orange Flag] Error reporting orange flag:', err);
    res.status(500).json({ success: false, message: 'Server error while reporting orange flag.' });
  }
};

/**
 * 3. Get Orange Flags for Authenticated Faculty
 * Scoped to faculty's authorized panel(s) and batch(es).
 */
exports.getMyFacultyOrangeFlags = async (req, res) => {
  try {
    const { isPreview, assignedPanelIds, assignedBatchIds } = getFacultyScopeArrays(req);
    const facultyId = req.user?.id || null;
    const facultyEmail = req.userEmail || '';

    let query = `
      SELECT 
        of.*,
        u.phone as student_phone,
        (SELECT COUNT(*)::int FROM ri_orange_flag_history h WHERE h.flag_id = of.id) as history_count
      FROM ri_orange_flags of
      LEFT JOIN users u ON of.student_id = u.id
    `;

    const params = [];
    const whereClauses = [];

    if (!isPreview) {
      // Scoped to faculty panel or created by faculty
      if (assignedPanelIds.length > 0) {
        params.push(assignedPanelIds);
        whereClauses.push(`(
          of.ri_panel_id = ANY($${params.length}::int[]) 
          OR of.faculty_id = $${params.length + 1} 
          OR LOWER(of.faculty_email) = LOWER($${params.length + 2})
        )`);
        params.push(facultyId || 0, facultyEmail || '');
      } else if (facultyId) {
        params.push(facultyId, facultyEmail.toLowerCase());
        whereClauses.push(`(of.faculty_id = $1 OR LOWER(of.faculty_email) = $2)`);
      } else {
        params.push(facultyEmail.toLowerCase());
        whereClauses.push(`LOWER(of.faculty_email) = $1`);
      }

      if (assignedBatchIds.length > 0) {
        params.push(assignedBatchIds);
        whereClauses.push(`of.ri_batch_id = ANY($${params.length}::int[])`);
      }
    }

    if (req.query.panel_id && req.query.panel_id !== 'all') {
      params.push(parseInt(req.query.panel_id, 10));
      whereClauses.push(`of.ri_panel_id = $${params.length}`);
    }
    if (req.query.batch_id && req.query.batch_id !== 'all') {
      params.push(parseInt(req.query.batch_id, 10));
      whereClauses.push(`of.ri_batch_id = $${params.length}`);
    }
    if (req.query.status && req.query.status !== 'all') {
      params.push(req.query.status.toLowerCase().trim());
      whereClauses.push(`LOWER(of.status) = $${params.length}`);
    }
    if (req.query.category && req.query.category !== 'all') {
      params.push(req.query.category.trim());
      whereClauses.push(`LOWER(of.category) = LOWER($${params.length})`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY of.created_at DESC`;

    const result = await pool.query(query, params);

    // Compute stats for current faculty scope
    let statsQuery = `
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'open')::int as open,
        COUNT(*) FILTER (WHERE status = 'under_follow_up')::int as under_follow_up,
        COUNT(*) FILTER (WHERE status = 'resolved')::int as resolved
      FROM ri_orange_flags of
    `;
    const statsWhere = [];
    const statsParams = [];

    if (!isPreview) {
      if (assignedPanelIds.length > 0) {
        statsParams.push(assignedPanelIds, facultyId || 0, facultyEmail || '');
        statsWhere.push(`(
          of.ri_panel_id = ANY($1::int[]) 
          OR of.faculty_id = $2 
          OR LOWER(of.faculty_email) = LOWER($3)
        )`);
      } else if (facultyId) {
        statsParams.push(facultyId, facultyEmail.toLowerCase());
        statsWhere.push(`(of.faculty_id = $1 OR LOWER(of.faculty_email) = $2)`);
      }
    }

    if (statsWhere.length > 0) {
      statsQuery += ` WHERE ${statsWhere.join(' AND ')}`;
    }

    const statsRes = await pool.query(statsQuery, statsParams);

    res.json({
      success: true,
      orangeFlags: result.rows,
      stats: statsRes.rows[0] || {
        total: 0,
        open: 0,
        under_follow_up: 0,
        resolved: 0
      }
    });
  } catch (err) {
    console.error('[RI Orange Flag] Error fetching faculty orange flags:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving your orange flags.' });
  }
};

/**
 * 4. Get All Orange Flags (Admin & Super Admin)
 * With filters, search, metrics, batch/panel dropdowns.
 */
exports.getAllOrangeFlags = async (req, res) => {
  try {
    const { batch_id, panel_id, category, status, search, start_date, end_date } = req.query;

    const whereClauses = [];
    const params = [];

    if (batch_id && batch_id !== 'all') {
      params.push(parseInt(batch_id, 10));
      whereClauses.push(`of.ri_batch_id = $${params.length}`);
    }

    if (panel_id && panel_id !== 'all') {
      params.push(parseInt(panel_id, 10));
      whereClauses.push(`of.ri_panel_id = $${params.length}`);
    }

    if (category && category !== 'all') {
      params.push(category.trim());
      whereClauses.push(`LOWER(of.category) = LOWER($${params.length})`);
    }

    if (status && status !== 'all') {
      params.push(status.trim().toLowerCase());
      whereClauses.push(`LOWER(of.status) = LOWER($${params.length})`);
    }

    if (start_date) {
      params.push(new Date(start_date));
      whereClauses.push(`of.incident_date_time >= $${params.length}`);
    }

    if (end_date) {
      const eDate = new Date(end_date);
      eDate.setHours(23, 59, 59, 999);
      params.push(eDate);
      whereClauses.push(`of.incident_date_time <= $${params.length}`);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      whereClauses.push(`(
        LOWER(of.student_name) LIKE $${params.length} OR 
        LOWER(of.student_email) LIKE $${params.length} OR 
        LOWER(of.student_prn) LIKE $${params.length} OR 
        LOWER(of.faculty_name) LIKE $${params.length} OR
        LOWER(of.panel_name) LIKE $${params.length} OR
        LOWER(of.village_name) LIKE $${params.length} OR
        LOWER(of.description) LIKE $${params.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const listQuery = `
      SELECT 
        of.*,
        u.phone as student_phone,
        (SELECT COUNT(*)::int FROM ri_orange_flag_history h WHERE h.flag_id = of.id) as history_count
      FROM ri_orange_flags of
      LEFT JOIN users u ON of.student_id = u.id
      ${whereSql}
      ORDER BY of.created_at DESC
    `;

    const [listRes, statsRes, batchesRes, panelsRes] = await Promise.all([
      pool.query(listQuery, params),
      pool.query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status = 'open')::int as open,
          COUNT(*) FILTER (WHERE status = 'under_follow_up')::int as under_follow_up,
          COUNT(*) FILTER (WHERE status = 'resolved')::int as resolved,
          COUNT(*) FILTER (WHERE LOWER(category) = 'minor injury')::int as minor_injury,
          COUNT(*) FILTER (WHERE LOWER(category) = 'physical discomfort')::int as physical_discomfort,
          COUNT(*) FILTER (WHERE LOWER(category) = 'health concern')::int as health_concern,
          COUNT(*) FILTER (WHERE LOWER(category) = 'safety concern')::int as safety_concern,
          COUNT(*) FILTER (WHERE LOWER(category) = 'other non-critical incident')::int as other
        FROM ri_orange_flags
      `),
      pool.query(`SELECT id, name, batch_code FROM ri_batches WHERE status <> 'deleted' ORDER BY id DESC`),
      pool.query(`SELECT id, name, panel_number, ri_batch_id FROM ri_panels ORDER BY panel_number ASC`)
    ]);

    res.json({
      success: true,
      orangeFlags: listRes.rows,
      stats: statsRes.rows[0] || {
        total: 0,
        open: 0,
        under_follow_up: 0,
        resolved: 0,
        minor_injury: 0,
        physical_discomfort: 0,
        health_concern: 0,
        safety_concern: 0,
        other: 0
      },
      batches: batchesRes.rows,
      panels: panelsRes.rows
    });
  } catch (err) {
    console.error('[RI Orange Flag] Error fetching all orange flags:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving orange flags.' });
  }
};

/**
 * 5. Get Individual Orange Flag Details & Complete Follow-up History
 */
exports.getOrangeFlagDetails = async (req, res) => {
  try {
    const flagId = parseInt(req.params.id, 10);
    if (!flagId) {
      return res.status(400).json({ success: false, message: 'Invalid orange flag ID.' });
    }

    const flagRes = await pool.query(`
      SELECT 
        of.*,
        u.phone as student_phone
      FROM ri_orange_flags of
      LEFT JOIN users u ON of.student_id = u.id
      WHERE of.id = $1
    `, [flagId]);

    if (flagRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Orange flag incident not found.' });
    }

    const flag = flagRes.rows[0];

    // If faculty, verify scope
    const userRole = (req.user?.role || '').toLowerCase();
    const isFaculty = userRole === 'faculty' || userRole === 'ri_faculty';
    if (isFaculty) {
      const { isPreview, assignedPanelIds } = getFacultyScopeArrays(req);
      if (!isPreview) {
        const canAccess = assignedPanelIds.includes(flag.ri_panel_id) || 
                          flag.faculty_id === req.user?.id || 
                          (req.userEmail && flag.faculty_email?.toLowerCase() === req.userEmail.toLowerCase());
        if (!canAccess) {
          return res.status(403).json({ success: false, message: 'Unauthorized: You can only view incidents for your assigned panel.' });
        }
      }
    }

    // Retrieve history trail
    const historyRes = await pool.query(`
      SELECT * 
      FROM ri_orange_flag_history 
      WHERE flag_id = $1 
      ORDER BY created_at ASC
    `, [flagId]);

    res.json({
      success: true,
      orangeFlag: flag,
      history: historyRes.rows
    });
  } catch (err) {
    console.error('[RI Orange Flag] Error retrieving flag details:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving incident details.' });
  }
};

/**
 * 6. Add Follow-up Note and/or Transition Status (Faculty & Admin)
 */
exports.addFollowUpNote = async (req, res) => {
  try {
    const userRole = (req.user?.role || '').toLowerCase();
    if (userRole.includes('readonly')) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Read-only accounts cannot modify incidents.' });
    }

    const flagId = parseInt(req.params.id, 10);
    const { notes, status, resolution_notes } = req.body;

    if (!flagId) {
      return res.status(400).json({ success: false, message: 'Invalid orange flag ID.' });
    }

    const cleanNotes = (notes || '').trim();
    if (!cleanNotes && !status) {
      return res.status(400).json({ success: false, message: 'Please provide follow-up notes or a status update.' });
    }

    const flagRes = await pool.query('SELECT * FROM ri_orange_flags WHERE id = $1', [flagId]);
    if (flagRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Orange flag incident not found.' });
    }
    const currentFlag = flagRes.rows[0];

    // Verify faculty scope if caller is faculty
    const isFaculty = userRole === 'faculty' || userRole === 'ri_faculty';
    if (isFaculty) {
      const { isPreview, assignedPanelIds } = getFacultyScopeArrays(req);
      if (!isPreview) {
        const canAccess = assignedPanelIds.includes(currentFlag.ri_panel_id) || 
                          currentFlag.faculty_id === req.user?.id || 
                          (req.userEmail && currentFlag.faculty_email?.toLowerCase() === req.userEmail.toLowerCase());
        if (!canAccess) {
          return res.status(403).json({ success: false, message: 'Unauthorized: You can only modify incidents within your assigned panel.' });
        }
      }
    }

    let targetStatus = currentFlag.status;
    if (status) {
      const cleanStatus = status.toLowerCase().trim();
      if (!VALID_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      targetStatus = cleanStatus;
    } else if (cleanNotes && currentFlag.status === 'open') {
      // Adding notes automatically moves open incident to under_follow_up
      targetStatus = 'under_follow_up';
    }

    let updaterId = req.user?.id || null;
    if (updaterId) {
      const uExists = await pool.query('SELECT id FROM users WHERE id = $1', [updaterId]);
      if (uExists.rowCount === 0) updaterId = null;
    }
    let updaterName = req.user?.name || req.userEmail || 'Faculty Mentor';

    let isResolved = targetStatus === 'resolved';
    let resolvedBy = isResolved ? updaterId : currentFlag.resolved_by;
    let resolvedByName = isResolved ? updaterName : currentFlag.resolved_by_name;
    let resolvedAt = isResolved ? new Date() : (targetStatus === 'open' ? null : currentFlag.resolved_at);
    let finalResNotes = resolution_notes ? resolution_notes.trim() : (isResolved ? (cleanNotes || currentFlag.resolution_notes) : currentFlag.resolution_notes);

    // Update flag record
    const updateRes = await pool.query(`
      UPDATE ri_orange_flags
      SET 
        status = $1,
        resolution_notes = $2,
        resolved_by = $3,
        resolved_by_name = $4,
        resolved_at = $5,
        last_updated_by = $6,
        last_updated_by_name = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      targetStatus,
      finalResNotes,
      resolvedBy,
      resolvedByName,
      resolvedAt,
      updaterId,
      updaterName,
      flagId
    ]);

    const updatedFlag = updateRes.rows[0];

    // Determine action label for history
    let historyAction = 'NOTE_ADDED';
    if (targetStatus !== currentFlag.status) {
      if (targetStatus === 'resolved') historyAction = 'RESOLVED';
      else if (currentFlag.status === 'resolved' && targetStatus === 'open') historyAction = 'REOPENED';
      else historyAction = 'STATUS_UPDATED';
    }

    // Insert into history
    await pool.query(`
      INSERT INTO ri_orange_flag_history (
        flag_id,
        user_id,
        user_name,
        user_role,
        action,
        previous_status,
        new_status,
        notes,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      flagId,
      updaterId,
      updaterName,
      userRole,
      historyAction,
      currentFlag.status,
      targetStatus,
      cleanNotes || (isResolved ? `Incident marked as resolved. Notes: ${finalResNotes || 'None'}` : `Status updated to ${targetStatus}`)
    ]);

    // Log to RI Audit Trail
    await logRiAction(pool, {
      userId: updaterId,
      userEmail: req.userEmail || req.user?.email,
      userName: updaterName,
      userRole,
      action: 'UPDATE_ORANGE_FLAG',
      batchId: updatedFlag.ri_batch_id,
      panelId: updatedFlag.ri_panel_id,
      studentId: updatedFlag.student_id,
      recordId: flagId,
      details: {
        previous_status: currentFlag.status,
        new_status: targetStatus,
        notes: cleanNotes
      }
    });

    // Fetch updated history
    const historyRes = await pool.query(`
      SELECT * FROM ri_orange_flag_history WHERE flag_id = $1 ORDER BY created_at ASC
    `, [flagId]);

    res.json({
      success: true,
      message: isResolved ? 'Incident marked as resolved.' : 'Follow-up note recorded successfully.',
      orangeFlag: updatedFlag,
      history: historyRes.rows
    });
  } catch (err) {
    console.error('[RI Orange Flag] Error adding follow-up note:', err);
    res.status(500).json({ success: false, message: 'Server error saving follow-up note.' });
  }
};

/**
 * 7. Update Orange Flag Status (Admin & Faculty)
 */
exports.updateOrangeFlagStatus = async (req, res) => {
  return exports.addFollowUpNote(req, res);
};

/**
 * 8. Download Orange Flags Excel Export
 */
exports.downloadOrangeFlagsExcel = async (req, res) => {
  try {
    const { batch_id, panel_id, category, status, search } = req.query;

    const whereClauses = [];
    const params = [];

    if (batch_id && batch_id !== 'all') {
      params.push(parseInt(batch_id, 10));
      whereClauses.push(`of.ri_batch_id = $${params.length}`);
    }

    if (panel_id && panel_id !== 'all') {
      params.push(parseInt(panel_id, 10));
      whereClauses.push(`of.ri_panel_id = $${params.length}`);
    }

    if (category && category !== 'all') {
      params.push(category.trim());
      whereClauses.push(`LOWER(of.category) = LOWER($${params.length})`);
    }

    if (status && status !== 'all') {
      params.push(status.trim().toLowerCase());
      whereClauses.push(`LOWER(of.status) = LOWER($${params.length})`);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      whereClauses.push(`(
        LOWER(of.student_name) LIKE $${params.length} OR 
        LOWER(of.student_email) LIKE $${params.length} OR 
        LOWER(of.student_prn) LIKE $${params.length} OR 
        LOWER(of.faculty_name) LIKE $${params.length} OR
        LOWER(of.panel_name) LIKE $${params.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        of.*,
        u.phone as student_phone
      FROM ri_orange_flags of
      LEFT JOIN users u ON of.student_id = u.id
      ${whereSql}
      ORDER BY of.created_at DESC
    `;

    const result = await pool.query(query, params);

    const rows = result.rows.map((r, idx) => ({
      'Sr No': idx + 1,
      'Incident ID': r.id,
      'Student Name': r.student_name || 'N/A',
      'PRN': r.student_prn || 'N/A',
      'Email': r.student_email || 'N/A',
      'Phone': r.student_phone || 'N/A',
      'Department': r.department || 'N/A',
      'School': r.school || 'N/A',
      'Panel': r.panel_name || 'N/A',
      'Batch': r.batch_name || 'N/A',
      'Village': r.village_name || 'N/A',
      'Category': r.category || 'N/A',
      'Description': r.description || 'N/A',
      'Incident Date/Time': r.incident_date_time ? new Date(r.incident_date_time).toLocaleString('en-IN') : 'N/A',
      'Immediate Action Taken': r.action_taken || 'N/A',
      'Follow-up Required': r.follow_up_required ? 'YES' : 'NO',
      'Status': (r.status || 'open').toUpperCase().replace(/_/g, ' '),
      'Resolution Notes': r.resolution_notes || 'N/A',
      'Resolved By': r.resolved_by_name || 'N/A',
      'Resolved Date': r.resolved_at ? new Date(r.resolved_at).toLocaleString('en-IN') : 'N/A',
      'Reported By Faculty': r.faculty_name || 'N/A',
      'Faculty Email': r.faculty_email || 'N/A',
      'Medical Report Attached': r.medical_report_url ? 'YES' : 'NO',
      'Medical Report File': r.medical_report_name || (r.medical_report_url ? 'Report Attached' : 'None'),
      'Reported Date': r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : 'N/A',
      'Last Updated': r.updated_at ? new Date(r.updated_at).toLocaleString('en-IN') : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RI Orange Flags');

    if (rows.length > 0) {
      const colWidths = Object.keys(rows[0]).map(key => ({
        wch: Math.max(key.length + 3, ...rows.map(r => String(r[key] || '').length + 2).slice(0, 50))
      }));
      ws['!cols'] = colWidths;
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `RI_Orange_Flags_Report_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[RI Orange Flag] Error exporting Excel:', err);
    res.status(500).json({ success: false, message: 'Server error generating Excel report.' });
  }
};
