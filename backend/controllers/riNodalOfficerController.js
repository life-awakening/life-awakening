const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const { RI_ACTIVITIES, RI_ACTIVITY_LABEL_MAP, RI_ACTIVITY_MAP } = require('../utils/riConstants');

/**
 * Helper: Check if requesting user is assigned to the given panel or has elevated admin rights
 */
async function verifyPanelAccess(user, panelId) {
  if (!user || !panelId) return false;
  const userRole = (user.role || '').toLowerCase();
  
  // Super Admins and RI Admins have overarching view access
  if (['superadmin', 'superadmin-ri', 'superadmin_ri_readonly', 'ri_admin'].includes(userRole)) {
    return true;
  }

  const panelRes = await pool.query(
    `SELECT id, nodal_officer_user_id, nodal_officer_email FROM ri_panels WHERE id = $1`,
    [panelId]
  );
  if (panelRes.rowCount === 0) return false;
  const panelRow = panelRes.rows[0];
  const isIdMatch = Boolean(panelRow.nodal_officer_user_id && Number(panelRow.nodal_officer_user_id) === Number(user.id));
  const isEmailMatch = Boolean(panelRow.nodal_officer_email && user.email && panelRow.nodal_officer_email.toLowerCase().trim() === user.email.toLowerCase().trim());

  return isIdMatch || isEmailMatch;
}

/**
 * 1. Get all panels assigned to the logged-in Nodal Officer
 */
const getMyAssignedPanels = async (req, res) => {
  try {
    const userRole = (req.user?.role || '').toLowerCase();
    const isAdmin = ['superadmin', 'superadmin-ri', 'superadmin_ri_readonly', 'ri_admin'].includes(userRole);
    const { batchId } = req.query || {};

    let query = `
      SELECT 
        rp.id AS panel_id,
        rp.panel_number,
        rp.name AS panel_name,
        rp.capacity,
        rp.school,
        rp.department,
        COALESCE(rp.nodal_officer_name, '') AS nodal_officer_name,
        COALESCE(rp.nodal_officer_email, '') AS nodal_officer_email,
        rp.nodal_officer_user_id,
        rp.class_teacher_name,
        rp.ri_village_id,
        
        -- Batch information
        rb.id AS batch_id,
        rb.name AS batch_name,
        rb.batch_code,
        rb.status AS batch_status,
        rb.start_date,
        rb.end_date,

        -- Village details
        rv.id AS village_id,
        rv.name AS village_name,
        rv.address AS village_address,
        rv.detailed_address,
        rv.location AS village_location,
        rv.school_name,
        rv.principal_mobile,
        rv.spoc_name,
        rv.spoc_mobile,
        rv.sarpanch_name,
        rv.sarpanch_mobile,
        rv.district,
        rv.taluka,
        rv.google_maps_link,
        rv.remark AS village_remark,

        -- Student Metrics
        (SELECT COUNT(DISTINCT rbs.student_id)::int 
         FROM ri_batch_students rbs 
         WHERE rbs.ri_panel_id = rp.id) AS total_students,

        -- Attendance Breakdown 4 Activities
        (SELECT COUNT(*)::int FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.activity = 'SCHOOL_ACTIVITY' AND ra.status = 'Present') AS school_activity_present,
        (SELECT COUNT(*)::int FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.activity = 'SCHOOL_ACTIVITY' AND ra.status = 'Absent') AS school_activity_absent,

        (SELECT COUNT(*)::int FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.activity = 'INSTITUTIONAL_VISIT' AND ra.status = 'Present') AS institutional_visit_present,
        (SELECT COUNT(*)::int FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.activity = 'INSTITUTIONAL_VISIT' AND ra.status = 'Absent') AS institutional_visit_absent,

        (SELECT COUNT(*)::int FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.activity = 'FAMILY_SURVEY' AND ra.status = 'Present') AS family_survey_present,
        (SELECT COUNT(*)::int FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.activity = 'FAMILY_SURVEY' AND ra.status = 'Absent') AS family_survey_absent,

        (SELECT COUNT(*)::int FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.activity = 'COMMUNITY_PROJECT' AND ra.status = 'Present') AS community_project_present,
        (SELECT COUNT(*)::int FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.activity = 'COMMUNITY_PROJECT' AND ra.status = 'Absent') AS community_project_absent,

        -- Total distinct students marked absent on ANY activity in this panel
        (SELECT COUNT(DISTINCT ra.student_id)::int 
         FROM ri_attendance ra 
         WHERE ra.ri_panel_id = rp.id AND ra.status = 'Absent') AS total_unique_absentees,

        -- Undertakings completed in panel
        (SELECT COUNT(*)::int 
         FROM ri_batch_students rbs 
         JOIN users u ON rbs.student_id = u.id 
         WHERE rbs.ri_panel_id = rp.id AND (u.undertaking_submitted = true OR u.ri_undertaking_submitted = true)) AS undertakings_submitted

      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
    `;

    const params = [];
    const conditions = [];

    if (!isAdmin) {
      conditions.push(`(
        rp.nodal_officer_user_id = $${params.length + 1} 
        OR LOWER(TRIM(COALESCE(rp.nodal_officer_email, ''))) = LOWER(TRIM($${params.length + 2}))
      )`);
      params.push(req.user.id, req.user.email || '');
    }

    if (batchId) {
      conditions.push(`rp.ri_batch_id = $${params.length + 1}`);
      params.push(batchId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY rb.id DESC, rp.panel_number ASC`;

    const result = await pool.query(query, params);

    // Fetch Accompany Faculty for these panels
    const panelIds = result.rows.map(r => r.panel_id);
    let facultyMap = {};
    if (panelIds.length > 0) {
      const facRes = await pool.query(`
        SELECT 
          rbf.ri_panel_id,
          rbf.name,
          rbf.email,
          rbf.phone,
          rbf.role,
          rbf.department,
          rbf.designation
        FROM ri_batch_faculty rbf
        WHERE rbf.ri_panel_id = ANY($1)
        ORDER BY rbf.role ASC, rbf.name ASC
      `, [panelIds]);

      facRes.rows.forEach(f => {
        if (!facultyMap[f.ri_panel_id]) facultyMap[f.ri_panel_id] = [];
        facultyMap[f.ri_panel_id].push(f);
      });
    }

    const panelsWithFaculty = result.rows.map(panel => ({
      ...panel,
      faculty_mentors: facultyMap[panel.panel_id] || []
    }));

    res.json({
      success: true,
      nodal_officer: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        department: req.user.department,
        role: req.user.role
      },
      panels: panelsWithFaculty,
      total_panels: panelsWithFaculty.length
    });
  } catch (err) {
    console.error('[riNodalOfficerController.getMyAssignedPanels Error]', err);
    res.status(500).json({ message: 'Failed to fetch assigned panels', error: err.message });
  }
};

/**
 * 2. Get detailed info for a single assigned panel
 */
const getPanelDetails = async (req, res) => {
  const { panelId } = req.params;

  try {
    const hasAccess = await verifyPanelAccess(req.user, panelId);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'Access denied: You are only authorized to access your assigned panel(s).'
      });
    }

    const panelRes = await pool.query(`
      SELECT 
        rp.id AS panel_id,
        rp.panel_number,
        rp.name AS panel_name,
        rp.capacity,
        rp.school,
        rp.department,
        COALESCE(rp.nodal_officer_name, '') AS nodal_officer_name,
        COALESCE(rp.nodal_officer_email, '') AS nodal_officer_email,
        rp.class_teacher_name,
        rp.ri_village_id,
        
        rb.id AS batch_id,
        rb.name AS batch_name,
        rb.batch_code,
        rb.status AS batch_status,
        rb.start_date,
        rb.end_date,

        rv.id AS village_id,
        rv.name AS village_name,
        rv.address AS village_address,
        rv.detailed_address,
        rv.location AS village_location,
        rv.school_name,
        rv.principal_mobile,
        rv.spoc_name,
        rv.spoc_mobile,
        rv.sarpanch_name,
        rv.sarpanch_mobile,
        rv.district,
        rv.taluka,
        rv.google_maps_link,
        rv.remark AS village_remark
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rp.id = $1
    `, [panelId]);

    if (panelRes.rowCount === 0) {
      return res.status(404).json({ message: 'Panel not found' });
    }

    const panel = panelRes.rows[0];

    // Accompany faculty
    const facultyRes = await pool.query(`
      SELECT name, email, phone, role, department, designation
      FROM ri_batch_faculty
      WHERE ri_panel_id = $1
      ORDER BY role ASC, name ASC
    `, [panelId]);

    // Student roster metrics
    const studentMetricsRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT rbs.student_id)::int AS total_students,
        COUNT(DISTINCT CASE WHEN u.gender ILIKE 'male' OR u.gender ILIKE 'm' THEN rbs.student_id END)::int AS male_students,
        COUNT(DISTINCT CASE WHEN u.gender ILIKE 'female' OR u.gender ILIKE 'f' THEN rbs.student_id END)::int AS female_students,
        COUNT(DISTINCT CASE WHEN (u.undertaking_submitted = true OR u.ri_undertaking_submitted = true) THEN rbs.student_id END)::int AS undertakings_submitted
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      WHERE rbs.ri_panel_id = $1
    `, [panelId]);

    // Attendance metrics
    const attendanceRes = await pool.query(`
      SELECT 
        activity,
        status,
        COUNT(*)::int AS count
      FROM ri_attendance
      WHERE ri_panel_id = $1
      GROUP BY activity, status
    `, [panelId]);

    const attendanceStats = {
      SCHOOL_ACTIVITY: { present: 0, absent: 0 },
      INSTITUTIONAL_VISIT: { present: 0, absent: 0 },
      FAMILY_SURVEY: { present: 0, absent: 0 },
      COMMUNITY_PROJECT: { present: 0, absent: 0 }
    };

    attendanceRes.rows.forEach(r => {
      const actKey = RI_ACTIVITY_MAP[r.activity] || r.activity;
      const s = (r.status || '').toLowerCase();
      if (attendanceStats[actKey]) {
        if (s === 'present') attendanceStats[actKey].present = r.count;
        if (s === 'absent') attendanceStats[actKey].absent = r.count;
      }
    });

    res.json({
      success: true,
      panel: {
        ...panel,
        faculty_mentors: facultyRes.rows,
        metrics: studentMetricsRes.rows[0] || {},
        attendance: attendanceStats
      }
    });
  } catch (err) {
    console.error('[riNodalOfficerController.getPanelDetails Error]', err);
    res.status(500).json({ message: 'Failed to fetch panel details', error: err.message });
  }
};

/**
 * 3. Get Student Roster with live attendance for an assigned panel
 */
const getPanelStudents = async (req, res) => {
  const { panelId } = req.params || {};
  const { search, status, activity } = req.query || {};

  try {
    const hasAccess = await verifyPanelAccess(req.user, panelId);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'Access denied: You are only authorized to access your assigned panel(s).'
      });
    }

    let query = `
      SELECT 
        u.id AS student_id,
        u.name AS student_name,
        u.email AS student_email,
        u.prn,
        u.roll_number,
        u.phone,
        u.gender,
        u.department,
        u.division,
        COALESCE(u.ri_undertaking_submitted, u.undertaking_submitted, false) AS undertaking_submitted,
        COALESCE(u.ri_undertaking_signed_date, u.undertaking_signed_date) AS undertaking_submitted_at,
        rbs.ri_id,
        rbs.source_program,
        rp.name AS panel_name,
        rp.panel_number,
        rb.name AS batch_name,

        -- 4 Activities Attendance
        a1.status AS school_activity_status,
        a1.date AS school_activity_date,
        a2.status AS institutional_visit_status,
        a2.date AS institutional_visit_date,
        a3.status AS family_survey_status,
        a3.date AS family_survey_date,
        a4.status AS community_project_status,
        a4.date AS community_project_date,

        -- Absent flag
        CASE 
          WHEN a1.status = 'Absent' OR a2.status = 'Absent' OR a3.status = 'Absent' OR a4.status = 'Absent' THEN true 
          ELSE false 
        END AS is_absent_any_activity

      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_attendance a1 ON a1.student_id = u.id AND a1.ri_panel_id = rbs.ri_panel_id AND a1.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance a2 ON a2.student_id = u.id AND a2.ri_panel_id = rbs.ri_panel_id AND a2.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance a3 ON a3.student_id = u.id AND a3.ri_panel_id = rbs.ri_panel_id AND a3.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance a4 ON a4.student_id = u.id AND a4.ri_panel_id = rbs.ri_panel_id AND a4.activity = 'COMMUNITY_PROJECT'
      WHERE rbs.ri_panel_id = $1
    `;

    const params = [panelId];

    if (search && search.trim()) {
      query += ` AND (u.name ILIKE $${params.length + 1} OR u.prn ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1} OR u.department ILIKE $${params.length + 1})`;
      params.push(`%${search.trim()}%`);
    }

    if (status && status.toLowerCase() === 'absent') {
      if (day) {
        query += ` AND (
          (LOWER($${params.length + 1}) = 'day 1' AND d1.status = 'Absent') OR
          (LOWER($${params.length + 1}) = 'day 2' AND d2.status = 'Absent') OR
          (LOWER($${params.length + 1}) = 'day 3' AND d3.status = 'Absent')
        )`;
        params.push(day);
      } else {
        query += ` AND (d1.status = 'Absent' OR d2.status = 'Absent' OR d3.status = 'Absent')`;
      }
    } else if (status && status.toLowerCase() === 'present') {
      if (day) {
        query += ` AND (
          (LOWER($${params.length + 1}) = 'day 1' AND d1.status = 'Present') OR
          (LOWER($${params.length + 1}) = 'day 2' AND d2.status = 'Present') OR
          (LOWER($${params.length + 1}) = 'day 3' AND d3.status = 'Present')
        )`;
        params.push(day);
      } else {
        query += ` AND (d1.status = 'Present' OR d2.status = 'Present' OR d3.status = 'Present')`;
      }
    }

    query += ` ORDER BY u.name ASC, u.prn ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      panel_id: Number(panelId),
      total_students: result.rowCount,
      students: result.rows
    });
  } catch (err) {
    console.error('[riNodalOfficerController.getPanelStudents Error]', err);
    res.status(500).json({ message: 'Failed to fetch panel students', error: err.message });
  }
};

/**
 * 4. Get strictly ABSENT students for the assigned panel
 */
const getAbsentStudents = async (req, res) => {
  const { panelId } = req.params || {};
  const { search, day } = req.query || {};

  try {
    const hasAccess = await verifyPanelAccess(req.user, panelId);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'Access denied: You are only authorized to access your assigned panel(s).'
      });
    }

    let query = `
      SELECT 
        u.id AS student_id,
        u.name AS student_name,
        u.email AS student_email,
        u.prn,
        u.phone AS student_phone,
        u.gender,
        u.department,
        u.division,
        u.undertaking_submitted,
        rbs.ri_id,
        
        -- Panel & Village
        rp.name AS panel_name,
        rp.panel_number,
        rv.name AS village_name,
        rv.location AS village_location,
        rv.district,
        rv.taluka,
        rv.principal_mobile,
        rv.spoc_name,
        rv.spoc_mobile,

        -- Absent Activities breakdown (4 Activities)
        a1.status AS school_activity_status,
        a1.date AS school_activity_date,
        a2.status AS institutional_visit_status,
        a2.date AS institutional_visit_date,
        a3.status AS family_survey_status,
        a3.date AS family_survey_date,
        a4.status AS community_project_status,
        a4.date AS community_project_date,

        ARRAY_REMOVE(ARRAY[
          CASE WHEN a1.status = 'Absent' THEN 'School Activity' END,
          CASE WHEN a2.status = 'Absent' THEN 'Institutional Visit' END,
          CASE WHEN a3.status = 'Absent' THEN 'Family Visit' END,
          CASE WHEN a4.status = 'Absent' THEN 'Community Project' END
        ], NULL) AS absent_activities

      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      LEFT JOIN ri_attendance a1 ON a1.student_id = u.id AND a1.ri_panel_id = rbs.ri_panel_id AND a1.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance a2 ON a2.student_id = u.id AND a2.ri_panel_id = rbs.ri_panel_id AND a2.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance a3 ON a3.student_id = u.id AND a3.ri_panel_id = rbs.ri_panel_id AND a3.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance a4 ON a4.student_id = u.id AND a4.ri_panel_id = rbs.ri_panel_id AND a4.activity = 'COMMUNITY_PROJECT'
      WHERE rbs.ri_panel_id = $1
    `;

    const params = [panelId];
    const { activity } = req.query || {};

    if (activity && activity.trim()) {
      const normAct = RI_ACTIVITY_MAP[activity.trim()] || activity.trim();
      query += ` AND (
        ($${params.length + 1} = 'SCHOOL_ACTIVITY' AND a1.status = 'Absent') OR
        ($${params.length + 1} = 'INSTITUTIONAL_VISIT' AND a2.status = 'Absent') OR
        ($${params.length + 1} = 'FAMILY_SURVEY' AND a3.status = 'Absent') OR
        ($${params.length + 1} = 'COMMUNITY_PROJECT' AND a4.status = 'Absent')
      )`;
      params.push(normAct);
    } else {
      query += ` AND (a1.status = 'Absent' OR a2.status = 'Absent' OR a3.status = 'Absent' OR a4.status = 'Absent')`;
    }

    if (search && search.trim()) {
      query += ` AND (u.name ILIKE $${params.length + 1} OR u.prn ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY u.name ASC, u.prn ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      panel_id: Number(panelId),
      total_absent: result.rowCount,
      absent_students: result.rows
    });
  } catch (err) {
    console.error('[riNodalOfficerController.getAbsentStudents Error]', err);
    res.status(500).json({ message: 'Failed to fetch absent students', error: err.message });
  }
};

/**
 * 5. Export absent students to Excel (4 Activities)
 */
const exportAbsentStudentsExcel = async (req, res) => {
  const { panelId } = req.params;

  try {
    const hasAccess = await verifyPanelAccess(req.user, panelId);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'Access denied: You are only authorized to export your assigned panel(s).'
      });
    }

    const panelInfoRes = await pool.query(`
      SELECT rp.name AS panel_name, rp.panel_number, rb.name AS batch_name, rv.name AS village_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rp.id = $1
    `, [panelId]);

    const info = panelInfoRes.rows[0] || { panel_name: `Panel_${panelId}`, batch_name: 'RI' };

    const query = `
      SELECT 
        u.prn AS "PRN",
        u.name AS "Student Name",
        u.email AS "Email ID",
        u.phone AS "Contact Number",
        u.gender AS "Gender",
        u.department AS "Department",
        rp.name AS "Assigned Panel",
        rv.name AS "Assigned Village",
        COALESCE(a1.status, 'Unmarked') AS "School Activity Status",
        COALESCE(a2.status, 'Unmarked') AS "Institutional Visit Status",
        COALESCE(a3.status, 'Unmarked') AS "Family Visit Status",
        COALESCE(a4.status, 'Unmarked') AS "Community Project Status"
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      LEFT JOIN ri_attendance a1 ON a1.student_id = u.id AND a1.ri_panel_id = rbs.ri_panel_id AND a1.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance a2 ON a2.student_id = u.id AND a2.ri_panel_id = rbs.ri_panel_id AND a2.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance a3 ON a3.student_id = u.id AND a3.ri_panel_id = rbs.ri_panel_id AND a3.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance a4 ON a4.student_id = u.id AND a4.ri_panel_id = rbs.ri_panel_id AND a4.activity = 'COMMUNITY_PROJECT'
      WHERE rbs.ri_panel_id = $1 AND (a1.status = 'Absent' OR a2.status = 'Absent' OR a3.status = 'Absent' OR a4.status = 'Absent')
      ORDER BY u.name ASC, u.prn ASC
    `;

    const result = await pool.query(query, [panelId]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(result.rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Absent Students');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `RI_Absent_Students_${info.panel_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[riNodalOfficerController.exportAbsentStudentsExcel Error]', err);
    res.status(500).json({ message: 'Failed to export absent students', error: err.message });
  }
};

/**
 * 6. Change Nodal Officer Password
 */
const changeNodalOfficerPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }

  try {
    const userRes = await pool.query('SELECT id, password, email FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = userRes.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1, password_changed = true WHERE id = $2', [hashed, req.user.id]);

    return res.json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (err) {
    console.error('[riNodalOfficerController.changeNodalOfficerPassword Error]', err);
    res.status(500).json({ message: 'Failed to update password', error: err.message });
  }
};

module.exports = {
  getMyAssignedPanels,
  getPanelDetails,
  getPanelStudents,
  getAbsentStudents,
  exportAbsentStudentsExcel,
  changeNodalOfficerPassword
};
