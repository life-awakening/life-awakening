const pool = require('../config/db');
const XLSX = require('xlsx');

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
 * 1. Get Eligible Students for Faculty Red Flag Dropdown
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
    console.error('[RI Red Flag] Error fetching faculty students:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving students list.' });
  }
};

/**
 * 2. Raise a Red Flag (Faculty Only)
 * Backend validates that the target student is strictly assigned to the faculty's panel/batch.
 */
exports.raiseFacultyRedFlag = async (req, res) => {
  try {
    const { student_id, reason, description } = req.body;
    const parsedStudentId = parseInt(student_id, 10);

    if (!parsedStudentId) {
      return res.status(400).json({ success: false, message: 'Please select a valid student.' });
    }

    const cleanReason = (reason || '').trim();
    if (cleanReason.toLowerCase() === 'medical') {
      return res.status(400).json({ 
        success: false, 
        message: 'Medical cases should be reported under Orange Flag. Please use the Orange Flag section to log health concerns, injuries, or medical reports.' 
      });
    }
    const validReasons = ['Disciplinary', 'Others'];
    if (!validReasons.includes(cleanReason)) {
      return res.status(400).json({ 
        success: false, 
        message: `Reason must be one of: ${validReasons.join(', ')}` 
      });
    }

    const cleanDesc = (description || '').trim();
    if (!cleanDesc) {
      return res.status(400).json({ success: false, message: 'Please provide a detailed description for this red flag.' });
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

    // Strictly enforce panel authorization on the backend
    if (!isPreview) {
      if (!assignedPanelIds.includes(sData.ri_panel_id)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: You are only allowed to flag students within your assigned panel.'
        });
      }
      if (assignedBatchIds.length > 0 && !assignedBatchIds.includes(sData.ri_batch_id)) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Student does not belong to your active cohort batch.'
        });
      }
    }

    let facultyId = req.user?.id || null;
    if (facultyId) {
      const uExists = await pool.query('SELECT id FROM users WHERE id = $1', [facultyId]);
      if (uExists.rowCount === 0) {
        facultyId = null;
      }
    }
    let facultyName = req.user?.name || req.userEmail;
    let facultyEmail = req.userEmail || req.user?.email || '';

    // Check faculty name in users table or req.facultyAssignments
    if (req.facultyAssignments && req.facultyAssignments.length > 0) {
      facultyName = req.facultyAssignments[0].faculty_name || facultyName;
      facultyEmail = req.facultyAssignments[0].faculty_email || facultyEmail;
    }

    // Check for duplicate active flag with same student & reason
    const dupCheck = await pool.query(`
      SELECT id, status, created_at 
      FROM ri_red_flags 
      WHERE student_id = $1 AND ri_batch_id = $2 AND reason = $3 AND status = 'active'
    `, [parsedStudentId, sData.ri_batch_id, cleanReason]);

    if (dupCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: `An active "${cleanReason}" red flag already exists for student ${sData.student_name} (${sData.student_prn}).`
      });
    }

    // Insert new Red Flag
    const insertRes = await pool.query(`
      INSERT INTO ri_red_flags (
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
        reason,
        description,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active', NOW(), NOW())
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
      cleanReason,
      cleanDesc
    ]);

    const createdFlag = insertRes.rows[0];

    // Log notification for Admin
    try {
      await pool.query(`
        INSERT INTO ri_notifications (
          title,
          message,
          type,
          target_role,
          metadata,
          created_at
        ) VALUES ($1, $2, 'red_flag', 'admin', $3, NOW())
      `, [
        `Red Flag: ${cleanReason} (${sData.student_name})`,
        `Faculty ${facultyName} raised a "${cleanReason}" red flag for student ${sData.student_name} (PRN: ${sData.student_prn || 'N/A'}, Panel: ${sData.panel_name}).`,
        JSON.stringify({
          red_flag_id: createdFlag.id,
          student_id: parsedStudentId,
          reason: cleanReason,
          panel_name: sData.panel_name,
          batch_name: sData.batch_name
        })
      ]);
    } catch (notifErr) {
      console.warn('[RI Red Flag] Non-blocking notification insert warning:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Red flag successfully raised for ${sData.student_name}.`,
      redFlag: createdFlag
    });
  } catch (err) {
    console.error('[RI Red Flag] Error raising red flag:', err);
    res.status(500).json({ success: false, message: 'Server error while submitting red flag.' });
  }
};

/**
 * 3. Get Red Flags Raised by Authenticated Faculty
 */
exports.getMyFacultyRedFlags = async (req, res) => {
  try {
    const { isPreview, assignedPanelIds } = getFacultyScopeArrays(req);
    const facultyId = req.user?.id || null;
    const facultyEmail = req.userEmail || '';

    let query = `
      SELECT 
        rf.*,
        u.phone as student_phone
      FROM ri_red_flags rf
      LEFT JOIN users u ON rf.student_id = u.id
    `;

    const params = [];
    const whereClauses = [];

    if (!isPreview) {
      if (facultyId) {
        params.push(facultyId, facultyEmail.toLowerCase());
        whereClauses.push(`(rf.faculty_id = $1 OR LOWER(rf.faculty_email) = $2)`);
      } else {
        params.push(facultyEmail.toLowerCase());
        whereClauses.push(`LOWER(rf.faculty_email) = $1`);
      }
    }

    if (req.query.panel_id) {
      params.push(parseInt(req.query.panel_id, 10));
      whereClauses.push(`rf.ri_panel_id = $${params.length}`);
    }
    if (req.query.batch_id) {
      params.push(parseInt(req.query.batch_id, 10));
      whereClauses.push(`rf.ri_batch_id = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY rf.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      redFlags: result.rows
    });
  } catch (err) {
    console.error('[RI Red Flag] Error fetching faculty red flags:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving your red flags.' });
  }
};

/**
 * 4. Get All Red Flags (Admin & Super Admin)
 * With filters, search, metrics, and batch/panel dropdown options.
 */
exports.getAllRedFlags = async (req, res) => {
  try {
    const { batch_id, panel_id, reason, status, search } = req.query;

    const whereClauses = [];
    const params = [];

    if (batch_id && batch_id !== 'all') {
      params.push(parseInt(batch_id, 10));
      whereClauses.push(`rf.ri_batch_id = $${params.length}`);
    }

    if (panel_id && panel_id !== 'all') {
      params.push(parseInt(panel_id, 10));
      whereClauses.push(`rf.ri_panel_id = $${params.length}`);
    }

    if (reason && reason !== 'all') {
      params.push(reason.trim());
      whereClauses.push(`LOWER(rf.reason) = LOWER($${params.length})`);
    }

    if (status && status !== 'all') {
      params.push(status.trim());
      whereClauses.push(`LOWER(rf.status) = LOWER($${params.length})`);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      whereClauses.push(`(
        LOWER(rf.student_name) LIKE $${params.length} OR 
        LOWER(rf.student_email) LIKE $${params.length} OR 
        LOWER(rf.student_prn) LIKE $${params.length} OR 
        LOWER(rf.faculty_name) LIKE $${params.length} OR
        LOWER(rf.panel_name) LIKE $${params.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const listQuery = `
      SELECT 
        rf.*,
        u.phone as student_phone
      FROM ri_red_flags rf
      LEFT JOIN users u ON rf.student_id = u.id
      ${whereSql}
      ORDER BY rf.created_at DESC
    `;

    const [listRes, statsRes, batchesRes, panelsRes] = await Promise.all([
      pool.query(listQuery, params),
      pool.query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE LOWER(reason) = 'medical')::int as medical,
          COUNT(*) FILTER (WHERE LOWER(reason) = 'disciplinary' OR LOWER(reason) = 'discipline')::int as disciplinary,
          COUNT(*) FILTER (WHERE LOWER(reason) = 'others')::int as others,
          COUNT(*) FILTER (WHERE LOWER(status) = 'active')::int as active,
          COUNT(*) FILTER (WHERE LOWER(status) = 'reviewed')::int as reviewed,
          COUNT(*) FILTER (WHERE LOWER(status) = 'resolved')::int as resolved
        FROM ri_red_flags
      `),
      pool.query(`SELECT id, name, batch_code FROM ri_batches WHERE status <> 'deleted' ORDER BY id DESC`),
      pool.query(`SELECT id, name, panel_number, ri_batch_id FROM ri_panels ORDER BY panel_number ASC`)
    ]);

    res.json({
      success: true,
      redFlags: listRes.rows,
      stats: statsRes.rows[0] || {
        total: 0,
        medical: 0,
        disciplinary: 0,
        others: 0,
        active: 0,
        reviewed: 0,
        resolved: 0
      },
      batches: batchesRes.rows,
      panels: panelsRes.rows
    });
  } catch (err) {
    console.error('[RI Red Flag] Error fetching all red flags:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving red flags.' });
  }
};

/**
 * 5. Update Red Flag Status (Admin / Super Admin)
 */
exports.updateRedFlagStatus = async (req, res) => {
  try {
    const userRole = (req.user?.role || '').toLowerCase();
    if (userRole === 'superadmin_readonly' || userRole === 'superadmin_ri_readonly' || userRole === 'superadmin-ri-readonly') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Read-only super admins cannot modify red flags.' });
    }

    const flagId = parseInt(req.params.id, 10);
    const { status, admin_notes } = req.body;

    if (!flagId) {
      return res.status(400).json({ success: false, message: 'Invalid red flag ID.' });
    }

    const validStatuses = ['active', 'reviewed', 'resolved'];
    const cleanStatus = (status || '').toLowerCase().trim();
    if (!validStatuses.includes(cleanStatus)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const reviewerName = req.user?.name || (userRole.includes('superadmin') ? 'RI Super Admin' : 'RI Admin');
    let reviewerId = req.user?.id || null;
    if (reviewerId) {
      const uExists = await pool.query('SELECT id FROM users WHERE id = $1', [reviewerId]);
      if (uExists.rowCount === 0) {
        reviewerId = null;
      }
    }

    const updateRes = await pool.query(`
      UPDATE ri_red_flags
      SET 
        status = $1,
        admin_notes = COALESCE($2, admin_notes),
        reviewed_by = $3,
        reviewed_by_name = $4,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [cleanStatus, admin_notes !== undefined ? admin_notes.trim() : null, reviewerId, reviewerName, flagId]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Red flag not found.' });
    }

    res.json({
      success: true,
      message: `Red flag status updated to ${cleanStatus}.`,
      redFlag: updateRes.rows[0]
    });
  } catch (err) {
    console.error('[RI Red Flag] Error updating red flag status:', err);
    res.status(500).json({ success: false, message: 'Server error updating red flag.' });
  }
};

/**
 * 6. Download Red Flags Excel Export
 */
exports.downloadRedFlagsExcel = async (req, res) => {
  try {
    const { batch_id, panel_id, reason, status, search } = req.query;

    const whereClauses = [];
    const params = [];

    if (batch_id && batch_id !== 'all') {
      params.push(parseInt(batch_id, 10));
      whereClauses.push(`rf.ri_batch_id = $${params.length}`);
    }

    if (panel_id && panel_id !== 'all') {
      params.push(parseInt(panel_id, 10));
      whereClauses.push(`rf.ri_panel_id = $${params.length}`);
    }

    if (reason && reason !== 'all') {
      params.push(reason.trim());
      whereClauses.push(`LOWER(rf.reason) = LOWER($${params.length})`);
    }

    if (status && status !== 'all') {
      params.push(status.trim());
      whereClauses.push(`LOWER(rf.status) = LOWER($${params.length})`);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term);
      whereClauses.push(`(
        LOWER(rf.student_name) LIKE $${params.length} OR 
        LOWER(rf.student_email) LIKE $${params.length} OR 
        LOWER(rf.student_prn) LIKE $${params.length} OR 
        LOWER(rf.faculty_name) LIKE $${params.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        rf.*,
        u.phone as student_phone
      FROM ri_red_flags rf
      LEFT JOIN users u ON rf.student_id = u.id
      ${whereSql}
      ORDER BY rf.created_at DESC
    `;

    const result = await pool.query(query, params);

    const rows = result.rows.map((r, idx) => ({
      'Sr No': idx + 1,
      'Student Name': r.student_name || 'N/A',
      'Email': r.student_email || 'N/A',
      'PRN': r.student_prn || 'N/A',
      'Phone': r.student_phone || 'N/A',
      'Department': r.department || 'N/A',
      'School': r.school || 'N/A',
      'Panel': r.panel_name || 'N/A',
      'Batch': r.batch_name || 'N/A',
      'Village': r.village_name || 'N/A',
      'Reason': r.reason || 'N/A',
      'Description': r.description || 'N/A',
      'Raised By Faculty': r.faculty_name || 'N/A',
      'Faculty Email': r.faculty_email || 'N/A',
      'Status': (r.status || 'active').toUpperCase(),
      'Admin Notes': r.admin_notes || 'N/A',
      'Reviewed By': r.reviewed_by_name || 'N/A',
      'Reviewed Date': r.reviewed_at ? new Date(r.reviewed_at).toLocaleString('en-IN') : 'N/A',
      'Date Raised': r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RI Red Flags');

    // Auto-size columns
    if (rows.length > 0) {
      const colWidths = Object.keys(rows[0]).map(key => ({
        wch: Math.max(key.length + 3, ...rows.map(r => String(r[key] || '').length + 2).slice(0, 50))
      }));
      ws['!cols'] = colWidths;
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `RI_Red_Flags_Report_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[RI Red Flag] Error exporting Excel:', err);
    res.status(500).json({ success: false, message: 'Server error generating Excel report.' });
  }
};
