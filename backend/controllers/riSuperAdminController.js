const pool = require('../config/db');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { logRiAction } = require('../utils/riAudit');
const { RI_ACTIVITIES, RI_ACTIVITY_KEYS, RI_ACTIVITY_MAP, RI_ACTIVITY_LABEL_MAP, normalizeRiActivityKey } = require('../utils/riConstants');
const { calculateRiEvaluation, calculateRiVisitDeadlines, computeEffectiveAttendanceLock } = require('../utils/riEvaluationCalculator');

const writeAuditLog = async (userId, action, description, details = {}) => {
  try {
    let userEmail = details.user_email || null;
    let userName = details.user_name || 'RI Super Admin';
    let userRole = details.user_role || 'superadmin-ri';

    if (userId && (!userEmail || !userName || userName === 'RI Super Admin')) {
      try {
        const uRes = await pool.query('SELECT name, email, role FROM users WHERE id = $1', [userId]);
        if (uRes.rows.length > 0) {
          userEmail = uRes.rows[0].email || userEmail;
          userName = uRes.rows[0].name || userName;
          userRole = uRes.rows[0].role || userRole;
        } else {
          userId = null;
        }
      } catch (_) {
        userId = null;
      }
    }

    const studentId = details.student_id ? parseInt(details.student_id, 10) : null;
    const batchId = details.batch_id ? parseInt(details.batch_id, 10) : null;
    const panelId = details.panel_id ? parseInt(details.panel_id, 10) : null;

    await logRiAction(pool, {
      userId: userId || null,
      userEmail,
      userName,
      userRole,
      action,
      studentId: isNaN(studentId) ? null : studentId,
      batchId: isNaN(batchId) ? null : batchId,
      panelId: isNaN(panelId) ? null : panelId,
      recordId: details.record_id ? String(details.record_id) : (details.user_id ? String(details.user_id) : null),
      details: { description, ...details },
      ipAddress: details.ip_address || null
    });
  } catch (e) {
    console.error('[RI SuperAdmin writeAuditLog Error]', e.message);
  }
};

/**
 * RI Super Admin Controller
 * Dedicated high-performance analytics, batch management, panel/faculty mapping,
 * attendance, evaluation, undertakings, and report exports for role: `superadmin-ri`.
 */

// ─── 1. Executive Analytics & Dashboard Overview ─────────────────────────────
const getRiSuperAdminAnalytics = async (req, res) => {
  try {
    const { batch_id } = req.query;
    const batchFilter = batch_id && !isNaN(parseInt(batch_id, 10)) ? parseInt(batch_id, 10) : null;

    // 1. Overview KPIs
    const overviewKpisQuery = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM ri_batch_students rbs 
         JOIN ri_batches rb ON rbs.ri_batch_id = rb.id AND rb.status <> 'deleted' 
         ${batchFilter ? `WHERE rbs.ri_batch_id = ${batchFilter}` : ''}) AS total_ri_students,
        (SELECT COUNT(*)::int FROM ri_batches WHERE status <> 'deleted') AS total_ri_batches,
        (SELECT COUNT(*)::int FROM ri_batches WHERE status <> 'deleted' AND (source_batch_id IS NULL OR source_program IN ('RI', 'RI_DIRECT'))) AS ri_direct_batches,
        (SELECT COUNT(*)::int FROM ri_batches WHERE status <> 'deleted' AND (source_batch_id IS NOT NULL OR source_program IN ('LTC', 'LTC_SYNC'))) AS ltc_synced_batches,
        (SELECT COUNT(*)::int FROM ri_batches WHERE status <> 'deleted' AND status = 'completed') AS completed_batches,
        (SELECT COUNT(*)::int FROM ri_panels ${batchFilter ? `WHERE ri_batch_id = ${batchFilter}` : ''}) AS total_ri_panels,
        (SELECT COUNT(*)::int FROM ri_villages WHERE status <> 'deleted' ${batchFilter ? `AND ri_batch_id = ${batchFilter}` : ''}) AS total_ri_villages,
        (SELECT COUNT(DISTINCT LOWER(email))::int FROM ri_batch_faculty WHERE status <> 'deleted' ${batchFilter ? `AND ri_batch_id = ${batchFilter}` : ''}) AS total_ri_faculty,
        (SELECT COUNT(DISTINCT LOWER(email))::int FROM ri_batch_faculty WHERE status = 'active' ${batchFilter ? `AND ri_batch_id = ${batchFilter}` : ''}) AS active_ri_faculty,
        (SELECT COUNT(*)::int FROM ri_undertakings WHERE status = 'Submitted') AS emails_sent
    `);

    // 1b. Gender Distribution for System Charts (actual valid RI students only)
    const genderDistQuery = await pool.query(`
      SELECT 
        CASE 
          WHEN LOWER(TRIM(u.gender)) IN ('male', 'm', 'boy') THEN 'Male'
          WHEN LOWER(TRIM(u.gender)) IN ('female', 'f', 'girl') THEN 'Female'
          ELSE 'Unspecified'
        END as gender,
        COUNT(rbs.id)::int as count
      FROM ri_batch_students rbs
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id AND rb.status <> 'deleted'
      LEFT JOIN users u ON rbs.student_id = u.id
      ${batchFilter ? 'WHERE rbs.ri_batch_id = $1' : ''}
      GROUP BY 1
      ORDER BY count DESC
    `, batchFilter ? [batchFilter] : []);

    // 1c. Students per Batch for System Charts
    const studentsPerBatchQuery = await pool.query(`
      SELECT 
        rb.id as batch_id,
        rb.name as batch_name,
        COALESCE(rb.batch_code, CONCAT('RI-', rb.id)) as batch_code,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_batch_id = rb.id) as student_count
      FROM ri_batches rb
      WHERE rb.status <> 'deleted'
      ORDER BY rb.id ASC
    `);

    // 2. Student Analytics & Breakdown
    const studentAnalyticsQuery = await pool.query(`
      SELECT
        COUNT(rbs.id)::int AS total_students,
        COUNT(CASE WHEN rbs.source_program IN ('RI', 'RI_DIRECT') OR rbs.enrollment_type IN ('RI_DIRECT', 'DIRECT_UPLOAD', 'RI_BULK_UPLOAD') THEN 1 END)::int AS ri_only_students,
        COUNT(CASE WHEN rbs.source_program IN ('LTC', 'LTC_SYNC') OR rbs.enrollment_type = 'LTC_SYNC' THEN 1 END)::int AS ltc_ri_students,
        COUNT(CASE WHEN (
          (ru.id IS NOT NULL AND (ru.status = 'Submitted' OR ru.status = 'approved'))
          OR u.undertaking_submitted = true
          OR u.ri_undertaking_submitted = true
          OR EXISTS (
            SELECT 1 FROM ri_student_forms rsf 
            WHERE rsf.student_id = rbs.student_id 
              AND rsf.form_type = 'UNDERTAKING' 
              AND (rsf.status = 'Submitted' OR rsf.status = 'approved' OR rsf.status = 'Reviewed')
          )
        ) THEN 1 END)::int AS undertaking_submitted,
        COUNT(CASE WHEN NOT (
          (ru.id IS NOT NULL AND (ru.status = 'Submitted' OR ru.status = 'approved'))
          OR u.undertaking_submitted = true
          OR u.ri_undertaking_submitted = true
          OR EXISTS (
            SELECT 1 FROM ri_student_forms rsf 
            WHERE rsf.student_id = rbs.student_id 
              AND rsf.form_type = 'UNDERTAKING' 
              AND (rsf.status = 'Submitted' OR rsf.status = 'approved' OR rsf.status = 'Reviewed')
          )
        ) THEN 1 END)::int AS undertaking_pending,
        (SELECT COUNT(*)::int FROM ri_student_forms rsf 
         JOIN ri_batch_students sub_rbs ON rsf.student_id = sub_rbs.student_id AND rsf.ri_batch_id = sub_rbs.ri_batch_id
         WHERE rsf.status = 'Completed' ${batchFilter ? `AND rsf.ri_batch_id = ${batchFilter}` : ''}) AS forms_completed,
        (SELECT COUNT(*)::int FROM ri_student_forms rsf 
         JOIN ri_batch_students sub_rbs ON rsf.student_id = sub_rbs.student_id AND rsf.ri_batch_id = sub_rbs.ri_batch_id
         WHERE rsf.status <> 'Completed' ${batchFilter ? `AND rsf.ri_batch_id = ${batchFilter}` : ''}) AS forms_pending
      FROM ri_batch_students rbs
      LEFT JOIN users u ON u.id = rbs.student_id
      LEFT JOIN ri_undertakings ru ON ru.student_id = rbs.student_id
      ${batchFilter ? 'WHERE rbs.ri_batch_id = $1' : ''}
    `, batchFilter ? [batchFilter] : []);

    // 3. Undertaking Analytics (Student vs Faculty Breakdown)
    const totalStudentsCount = parseInt(overviewKpisQuery.rows[0].total_ri_students, 10) || 0;
    const studentUndertakingSubmitted = parseInt(studentAnalyticsQuery.rows[0].undertaking_submitted, 10) || 0;
    const studentUndertakingPending = Math.max(0, totalStudentsCount - studentUndertakingSubmitted);

    // Faculty Undertakings (Check in users table or ri_batch_faculty or ri_faculty_undertakings)
    const facultyUndertakingQuery = await pool.query(`
      SELECT 
        COUNT(DISTINCT rbf.email)::int as total_faculty,
        COUNT(DISTINCT CASE WHEN (
          COALESCE(u.ri_undertaking_submitted, false) = true
          OR EXISTS (
            SELECT 1 FROM ri_faculty_undertakings rfu 
            WHERE (rfu.faculty_id = u.id OR rfu.faculty_id = rbf.faculty_id OR rfu.faculty_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email)))
              AND (rfu.status = 'Submitted' OR rfu.status IS NULL)
          )
        ) THEN rbf.email END)::int as faculty_undertaking_submitted
      FROM ri_batch_faculty rbf
      LEFT JOIN users u ON (rbf.faculty_id = u.id OR LOWER(rbf.email) = LOWER(u.email))
      WHERE rbf.status <> 'deleted' ${batchFilter ? `AND rbf.ri_batch_id = ${batchFilter}` : ''}
    `);
    const totalFacultyCount = parseInt(facultyUndertakingQuery.rows[0].total_faculty, 10) || 0;
    const facultyUndertakingSubmitted = parseInt(facultyUndertakingQuery.rows[0].faculty_undertaking_submitted, 10) || 0;
    const facultyUndertakingPending = Math.max(0, totalFacultyCount - facultyUndertakingSubmitted);

    // 4. Attendance Overview Metrics (4 Activities)
    const attendanceStatsQuery = await pool.query(`
      SELECT
        activity,
        COUNT(CASE WHEN status = 'Present' THEN 1 END)::int AS present_count,
        COUNT(CASE WHEN status = 'Absent' THEN 1 END)::int AS absent_count,
        COUNT(id)::int AS marked_total
      FROM ri_attendance
      ${batchFilter ? 'WHERE ri_batch_id = $1' : ''}
      GROUP BY activity
      ORDER BY activity ASC
    `, batchFilter ? [batchFilter] : []);

    const attendanceActivitiesMap = {};
    RI_ACTIVITIES.forEach(act => {
      attendanceActivitiesMap[act.key] = {
        activity_key: act.key,
        label: act.label,
        present: 0,
        absent: 0,
        unmarked: totalStudentsCount,
        total_marked: 0
      };
    });

    attendanceStatsQuery.rows.forEach(r => {
      const actKey = r.activity || 'SCHOOL_ACTIVITY';
      const unmarked = Math.max(0, totalStudentsCount - (r.marked_total || 0));
      attendanceActivitiesMap[actKey] = {
        activity_key: actKey,
        label: RI_ACTIVITY_LABEL_MAP[actKey] || actKey,
        present: r.present_count || 0,
        absent: r.absent_count || 0,
        unmarked: unmarked,
        total_marked: r.marked_total || 0
      };
    });

    // 5. Evaluation Overview Metrics
    const evaluationStatsQuery = await pool.query(`
      SELECT
        COUNT(DISTINCT rbs.student_id)::int AS total_eligible_students,
        COUNT(DISTINCT re.student_id)::int AS evaluated_students,
        COUNT(CASE WHEN re.evaluation_status = 'Submitted' OR re.evaluation_status = 'Completed' THEN 1 END)::int AS completed_evaluations,
        COUNT(CASE WHEN re.evaluation_status = 'Draft' OR re.evaluation_status IS NULL THEN 1 END)::int AS pending_evaluations,
        COALESCE(AVG(re.total_marks), 0)::numeric(5,2) AS average_marks
      FROM ri_batch_students rbs
      LEFT JOIN ri_evaluations re ON rbs.student_id = re.student_id AND rbs.ri_batch_id = re.ri_batch_id
      ${batchFilter ? 'WHERE rbs.ri_batch_id = $1' : ''}
    `, batchFilter ? [batchFilter] : []);

    // 6. Batch-wise Undertaking & Completion Breakdown
    const batchBreakdownQuery = await pool.query(`
      SELECT
        rb.id AS batch_id,
        rb.name AS batch_name,
        COALESCE(rb.batch_code, b.batch_code, CONCAT('RI-', rb.id)) AS batch_code,
        CASE 
          WHEN rb.source_batch_id IS NOT NULL OR rb.source_program IN ('LTC', 'LTC_SYNC') THEN 'LTC_SYNC'
          ELSE 'RI_DIRECT'
        END AS source_program,
        rb.status,
        rb.start_date,
        rb.end_date,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_batch_id = rb.id) AS total_students,
        (SELECT COUNT(*)::int FROM ri_panels rp WHERE rp.ri_batch_id = rb.id) AS total_panels,
        (SELECT COUNT(*)::int FROM ri_villages rv WHERE rv.ri_batch_id = rb.id AND rv.status <> 'deleted') AS total_villages,
        (SELECT COUNT(DISTINCT LOWER(rbf.email))::int FROM ri_batch_faculty rbf WHERE rbf.ri_batch_id = rb.id AND rbf.status <> 'deleted') AS total_faculty,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs 
         JOIN users u ON u.id = rbs.student_id
         LEFT JOIN ri_undertakings ru ON ru.student_id = rbs.student_id 
         WHERE rbs.ri_batch_id = rb.id AND (
           (ru.id IS NOT NULL AND (ru.status = 'Submitted' OR ru.status = 'approved'))
           OR u.undertaking_submitted = true
           OR u.ri_undertaking_submitted = true
           OR EXISTS (
             SELECT 1 FROM ri_student_forms rsf 
             WHERE rsf.student_id = rbs.student_id 
               AND rsf.form_type = 'UNDERTAKING' 
               AND (rsf.status = 'Submitted' OR rsf.status = 'approved' OR rsf.status = 'Reviewed')
           )
         )) AS undertaking_completed,
        (SELECT COUNT(*)::int FROM ri_evaluations re WHERE re.ri_batch_id = rb.id AND re.evaluation_status IN ('Submitted', 'Completed')) AS evaluations_completed
      FROM ri_batches rb
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      WHERE rb.status <> 'deleted'
      ORDER BY rb.id ASC
    `);

    res.json({
      overview: overviewKpisQuery.rows[0],
      gender_distribution: genderDistQuery.rows,
      students_per_batch: studentsPerBatchQuery.rows,
      student_analytics: {
        ...studentAnalyticsQuery.rows[0],
        total_students: totalStudentsCount,
        undertaking_submitted: studentUndertakingSubmitted,
        undertaking_pending: studentUndertakingPending
      },
      undertaking_analytics: {
        total_required: totalStudentsCount + totalFacultyCount,
        total_submitted: studentUndertakingSubmitted + facultyUndertakingSubmitted,
        total_pending: studentUndertakingPending + facultyUndertakingPending,
        student: {
          required: totalStudentsCount,
          submitted: studentUndertakingSubmitted,
          pending: studentUndertakingPending,
          percentage: totalStudentsCount > 0 ? Math.round((studentUndertakingSubmitted / totalStudentsCount) * 100) : 0
        },
        faculty: {
          required: totalFacultyCount,
          submitted: facultyUndertakingSubmitted,
          pending: facultyUndertakingPending,
          percentage: totalFacultyCount > 0 ? Math.round((facultyUndertakingSubmitted / totalFacultyCount) * 100) : 0
        }
      },
      attendance_overview: {
        school_activity: attendanceActivitiesMap.SCHOOL_ACTIVITY,
        institutional_visit: attendanceActivitiesMap.INSTITUTIONAL_VISIT,
        family_survey: attendanceActivitiesMap.FAMILY_SURVEY,
        community_project: attendanceActivitiesMap.COMMUNITY_PROJECT,
        activities: attendanceActivitiesMap
      },
      evaluation_overview: {
        total_evaluations: totalStudentsCount,
        completed: parseInt(evaluationStatsQuery.rows[0]?.completed_evaluations, 10) || 0,
        pending: Math.max(0, totalStudentsCount - (parseInt(evaluationStatsQuery.rows[0]?.completed_evaluations, 10) || 0)),
        average_marks: evaluationStatsQuery.rows[0]?.average_marks || 0,
        completion_rate: totalStudentsCount > 0 
          ? Math.round(((parseInt(evaluationStatsQuery.rows[0]?.completed_evaluations, 10) || 0) / totalStudentsCount) * 100) 
          : 0
      },
      batch_breakdown: batchBreakdownQuery.rows.map(b => {
        const students = parseInt(b.total_students, 10) || 0;
        const uCompleted = parseInt(b.undertaking_completed, 10) || 0;
        const eCompleted = parseInt(b.evaluations_completed, 10) || 0;
        const rate = students > 0 ? (uCompleted / students) * 100 : 0;
        return {
          ...b,
          undertaking_pending: Math.max(0, students - uCompleted),
          undertaking_rate: rate > 0 && rate < 1 ? Number(rate.toFixed(1)) : Math.round(rate),
          evaluation_rate: students > 0 ? Math.round((eCompleted / students) * 100) : 0
        };
      })
    });
  } catch (err) {
    console.error('[riSuperAdminController.getRiSuperAdminAnalytics Error]', err);
    res.status(500).json({ message: 'Failed to load RI Super Admin analytics', error: err.message });
  }
};

// ─── 2. Get All RI Batches with Comprehensive Metrics ─────────────────────────
const getRiSuperAdminBatches = async (req, res) => {
  try {
    const { source, status, search } = req.query;

    let query = `
      SELECT
        rb.id,
        rb.name,
        COALESCE(rb.batch_code, b.batch_code, CONCAT('RI-', rb.id)) AS batch_code,
        CASE 
          WHEN rb.source_batch_id IS NOT NULL OR rb.source_program IN ('LTC', 'LTC_SYNC') THEN 'LTC_SYNC'
          ELSE 'RI_DIRECT'
        END AS source_program,
        rb.source_batch_id,
        rb.panel_capacity,
        rb.status,
        rb.start_date,
        rb.end_date,
        rb.location,
        rb.year,
        COALESCE(rb.is_locked, false) AS is_locked,
        rb.description,
        rb.created_at,
        b.name AS source_ltc_batch_name,
        (SELECT COUNT(*)::int FROM ri_panels rp WHERE rp.ri_batch_id = rb.id) AS total_panels,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_batch_id = rb.id) AS total_students,
        (SELECT COUNT(*)::int FROM ri_villages rv WHERE rv.ri_batch_id = rb.id AND COALESCE(rv.status, 'active') <> 'deleted') AS total_villages,
        (SELECT COUNT(DISTINCT LOWER(rbf.email))::int FROM ri_batch_faculty rbf WHERE rbf.ri_batch_id = rb.id AND COALESCE(rbf.status, 'active') <> 'deleted') AS total_faculty,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs 
         JOIN users u ON u.id = rbs.student_id
         LEFT JOIN ri_undertakings ru ON ru.student_id = rbs.student_id 
         WHERE rbs.ri_batch_id = rb.id AND (
           (ru.id IS NOT NULL AND (ru.status = 'Submitted' OR ru.status = 'approved'))
           OR u.undertaking_submitted = true
           OR u.ri_undertaking_submitted = true
           OR EXISTS (
             SELECT 1 FROM ri_student_forms rsf 
             WHERE rsf.student_id = rbs.student_id 
               AND rsf.form_type = 'UNDERTAKING' 
               AND (rsf.status = 'Submitted' OR rsf.status = 'approved' OR rsf.status = 'Reviewed')
           )
         )) AS undertaking_completed,
        (SELECT COUNT(*)::int FROM ri_attendance ra WHERE ra.ri_batch_id = rb.id AND ra.activity = 'SCHOOL_ACTIVITY' AND ra.status = 'Present') AS school_activity_present,
        (SELECT COUNT(*)::int FROM ri_attendance ra WHERE ra.ri_batch_id = rb.id AND ra.activity = 'INSTITUTIONAL_VISIT' AND ra.status = 'Present') AS institutional_visit_present,
        (SELECT COUNT(*)::int FROM ri_attendance ra WHERE ra.ri_batch_id = rb.id AND ra.activity = 'FAMILY_SURVEY' AND ra.status = 'Present') AS family_survey_present,
        (SELECT COUNT(*)::int FROM ri_attendance ra WHERE ra.ri_batch_id = rb.id AND ra.activity = 'COMMUNITY_PROJECT' AND ra.status = 'Present') AS community_project_present,
        (SELECT COUNT(*)::int FROM ri_evaluations re WHERE re.ri_batch_id = rb.id AND re.evaluation_status IN ('Submitted', 'Completed')) AS evaluations_completed
      FROM ri_batches rb
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      WHERE COALESCE(rb.status, 'active') <> 'deleted'
    `;

    const params = [];

    if (source && source !== 'all') {
      params.push(source.toUpperCase());
      if (source.toUpperCase() === 'LTC_SYNC') {
        query += ` AND (rb.source_batch_id IS NOT NULL OR rb.source_program IN ('LTC', 'LTC_SYNC'))`;
      } else {
        query += ` AND (rb.source_batch_id IS NULL AND rb.source_program IN ('RI', 'RI_DIRECT'))`;
      }
    }

    if (status && status !== 'all') {
      params.push(status.toLowerCase());
      query += ` AND LOWER(rb.status) = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.toLowerCase().trim()}%`);
      query += ` AND (LOWER(rb.name) LIKE $${params.length} OR LOWER(COALESCE(rb.batch_code, '')) LIKE $${params.length})`;
    }

    query += ` ORDER BY rb.id ASC`;

    let result;
    try {
      result = await pool.query(query, params);
    } catch (queryErr) {
      if (queryErr.code === '42703' || queryErr.code === '42P01') {
        console.warn('[riSuperAdminController.getRiSuperAdminBatches] Schema mismatch detected, self-healing database...', queryErr.message);
        await pool.query(`
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS batch_code VARCHAR(100);
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS location VARCHAR(255);
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS year VARCHAR(50);
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS panel_capacity INT DEFAULT 60;
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS source_program VARCHAR(50) DEFAULT 'LTC';
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS source_batch_id INT REFERENCES batches(id) ON DELETE SET NULL;
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS start_date DATE;
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS end_date DATE;
          ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS description TEXT;
          ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
          ALTER TABLE ri_batch_faculty ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
          ALTER TABLE ri_evaluations ADD COLUMN IF NOT EXISTS evaluation_status VARCHAR(50) DEFAULT 'Draft';
        `);
        result = await pool.query(query, params);
      } else {
        throw queryErr;
      }
    }

    const batches = result.rows.map(b => {
      const students = parseInt(b.total_students, 10) || 0;
      const uCompleted = parseInt(b.undertaking_completed, 10) || 0;
      const uPending = Math.max(0, students - uCompleted);
      const eCompleted = parseInt(b.evaluations_completed, 10) || 0;
      const uRate = students > 0 ? (uCompleted / students) * 100 : 0;
      return {
        ...b,
        student_count: students,
        faculty_count: parseInt(b.total_faculty, 10) || 0,
        undertaking_pending: uPending,
        undertaking_progress: uRate > 0 && uRate < 1 ? Number(uRate.toFixed(1)) : Math.round(uRate),
        evaluation_progress: students > 0 ? Math.round((eCompleted / students) * 100) : 0
      };
    });

    res.json({ batches });
  } catch (err) {
    console.error('[riSuperAdminController.getRiSuperAdminBatches Error]', err);
    res.status(500).json({ message: 'Failed to fetch RI batches', error: err.message });
  }
};

// ─── 3. Get Full Comprehensive Batch Details for Drilldown ───────────────────
const getRiSuperAdminBatchDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const batchId = parseInt(id, 10);
    if (!batchId) return res.status(400).json({ message: 'Invalid Batch ID' });

    // 1. Batch Info
    const batchRes = await pool.query(`
      SELECT 
        rb.*,
        COALESCE(rb.batch_code, b.batch_code, CONCAT('RI-', rb.id)) AS batch_code,
        CASE 
          WHEN rb.source_batch_id IS NOT NULL OR rb.source_program IN ('LTC', 'LTC_SYNC') THEN 'LTC_SYNC'
          ELSE 'RI_DIRECT'
        END AS source_program,
        b.name AS source_batch_name
      FROM ri_batches rb
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      WHERE rb.id = $1 AND COALESCE(rb.status, 'active') <> 'deleted'
    `, [batchId]);

    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const batch = batchRes.rows[0];

    // 2. Panels with Village and Multiple Assigned Faculty
    const panelsRes = await pool.query(`
      SELECT 
        rp.id,
        rp.panel_number,
        rp.name,
        rp.capacity,
        rp.ri_village_id,
        rv.name AS village_name,
        rv.location AS village_location,
        rv.sarpanch_name,
        rv.sarpanch_mobile,
        rv.district AS village_district,
        COUNT(DISTINCT rbs.student_id)::int AS student_count
      FROM ri_panels rp
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id AND rbs.ri_batch_id = $1
      WHERE rp.ri_batch_id = $1
      GROUP BY rp.id, rv.id
      ORDER BY rp.panel_number ASC
    `, [batchId]);

    // 3. Faculty Assignments for this batch
    const facultyRes = await pool.query(`
      SELECT 
        rbf.id AS assignment_id,
        rbf.ri_batch_id,
        rbf.ri_panel_id,
        rbf.faculty_id,
        rbf.name,
        rbf.email,
        rbf.phone,
        rbf.department,
        rbf.designation,
        rbf.employee_id,
        rbf.role,
        rbf.status,
        rp.panel_number,
        rp.name AS panel_name,
        rv.id AS village_id,
        rv.name AS village_name,
        COALESCE(
          u.ri_undertaking_submitted,
          EXISTS(
            SELECT 1 FROM ri_faculty_undertakings rfu_sub 
            WHERE (rfu_sub.faculty_id = u.id OR rfu_sub.faculty_id = rbf.faculty_id OR rfu_sub.faculty_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email)))
              AND (rfu_sub.status = 'Submitted' OR rfu_sub.status IS NULL)
          ),
          false
        ) AS faculty_undertaking_submitted,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_panel_id = rbf.ri_panel_id AND rbs.ri_batch_id = $1) AS student_count
      FROM ri_batch_faculty rbf
      LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      LEFT JOIN users u ON (rbf.faculty_id = u.id OR LOWER(rbf.email) = LOWER(u.email))
      WHERE rbf.ri_batch_id = $1 AND COALESCE(rbf.status, 'active') <> 'deleted'
      ORDER BY rp.panel_number ASC, rbf.name ASC
    `, [batchId]);

    // Attach faculty list to each panel
    const facultyByPanel = {};
    facultyRes.rows.forEach(f => {
      if (!facultyByPanel[f.ri_panel_id]) {
        facultyByPanel[f.ri_panel_id] = [];
      }
      facultyByPanel[f.ri_panel_id].push(f);
    });

    const panelsWithFaculty = panelsRes.rows.map(p => ({
      ...p,
      faculty_list: facultyByPanel[p.id] || []
    }));

    // 4. Villages for this batch
    const villagesRes = await pool.query(`
      SELECT 
        rv.*,
        (SELECT COUNT(*)::int FROM ri_panels rp WHERE rp.ri_village_id = rv.id AND rp.ri_batch_id = $1) AS panel_count,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs 
         JOIN ri_panels rp ON rbs.ri_panel_id = rp.id 
         WHERE rp.ri_village_id = rv.id AND rbs.ri_batch_id = $1) AS student_count
      FROM ri_villages rv
      WHERE rv.ri_batch_id = $1 AND COALESCE(rv.status, 'active') <> 'deleted'
      ORDER BY rv.name ASC
    `, [batchId]);

    // Attach assigned faculty and panels to villages
    const villagesWithDetails = villagesRes.rows.map(v => {
      const vPanels = panelsWithFaculty.filter(p => p.ri_village_id === v.id);
      const vFaculty = facultyRes.rows.filter(f => f.village_id === v.id);
      return {
        ...v,
        panels: vPanels,
        faculty: vFaculty
      };
    });

    // 5. Students roster for this batch
    const studentsRes = await pool.query(`
      SELECT 
        rbs.id AS enrollment_id,
        rbs.ri_id,
        rbs.source_program,
        rbs.enrollment_type,
        u.id AS student_id,
        u.name AS student_name,
        u.email AS student_email,
        u.prn,
        u.roll_number,
        u.department,
        u.division,
        u.phone,
        u.gender,
        rp.id AS panel_id,
        rp.panel_number,
        rp.name AS panel_name,
        rv.id AS village_id,
        rv.name AS village_name,
        (CASE 
          WHEN (ru.id IS NOT NULL AND (ru.status = 'Submitted' OR ru.status = 'approved'))
            OR u.undertaking_submitted = true
            OR u.ri_undertaking_submitted = true
            OR EXISTS (
              SELECT 1 FROM ri_student_forms rsf 
              WHERE rsf.student_id = u.id 
                AND rsf.form_type = 'UNDERTAKING' 
                AND (rsf.status = 'Submitted' OR rsf.status = 'approved' OR rsf.status = 'Reviewed')
            ) THEN 'Submitted'
          ELSE COALESCE(ru.status, 'Pending')
        END) AS undertaking_status,
        COALESCE(ru.signed_name, u.undertaking_signed_name, u.name) AS undertaking_signed_name,
        COALESCE(ru.signed_date, u.ri_undertaking_signed_date, u.undertaking_signed_date, ru.created_at::text) AS undertaking_signed_date,
        COALESCE(ru.emergency_contact_name, u.emergency_contact_name) AS emergency_contact_name,
        COALESCE(ru.emergency_contact_mobile, u.emergency_contact_mobile) AS emergency_contact_mobile,
        a1.status AS school_activity_attendance,
        a2.status AS institutional_visit_attendance,
        a3.status AS family_survey_attendance,
        a4.status AS community_project_attendance,
        re.total_marks AS evaluation_marks,
        re.overall_grade AS evaluation_grade,
        re.evaluation_status,
        (SELECT COUNT(*)::int FROM ri_student_forms rsf WHERE rsf.student_id = u.id AND rsf.ri_batch_id = $1 AND rsf.status = 'Completed') AS forms_completed_count,
        (SELECT COUNT(*)::int FROM ri_student_forms rsf WHERE rsf.student_id = u.id AND rsf.ri_batch_id = $1) AS forms_total_count
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      LEFT JOIN ri_undertakings ru ON ru.student_id = u.id
      LEFT JOIN ri_attendance a1 ON a1.student_id = u.id AND a1.ri_batch_id = $1 AND a1.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance a2 ON a2.student_id = u.id AND a2.ri_batch_id = $1 AND a2.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance a3 ON a3.student_id = u.id AND a3.ri_batch_id = $1 AND a3.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance a4 ON a4.student_id = u.id AND a4.ri_batch_id = $1 AND a4.activity = 'COMMUNITY_PROJECT'
      LEFT JOIN ri_evaluations re ON re.student_id = u.id AND re.ri_batch_id = $1
      WHERE rbs.ri_batch_id = $1
      ORDER BY rp.panel_number ASC, u.roll_number ASC, u.name ASC
    `, [batchId]);

    // 6. Attendance Summary Matrix
    const attendanceMatrixRes = await pool.query(`
      SELECT 
        activity,
        COUNT(CASE WHEN status = 'Present' THEN 1 END)::int AS present,
        COUNT(CASE WHEN status = 'Absent' THEN 1 END)::int AS absent,
        COUNT(id)::int AS total_marked
      FROM ri_attendance
      WHERE ri_batch_id = $1
      GROUP BY activity
      ORDER BY activity ASC
    `, [batchId]);

    // 7. Evaluations Records & Summary
    const evaluationsRes = await pool.query(`
      SELECT 
        re.*,
        u.name AS student_name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number) AS ri_id,
        u.department,
        rp.panel_number,
        rp.name AS panel_name,
        eval_u.name AS evaluator_name
      FROM ri_evaluations re
      JOIN users u ON re.student_id = u.id
      JOIN ri_batch_students rbs ON rbs.student_id = u.id AND rbs.ri_batch_id = $1
      LEFT JOIN ri_panels rp ON re.ri_panel_id = rp.id
      LEFT JOIN users eval_u ON re.evaluator_faculty_id = eval_u.id
      WHERE re.ri_batch_id = $1
      ORDER BY rp.panel_number ASC, u.name ASC
    `, [batchId]);

    // 8. Deliverables & Forms Breakdown
    const formsBreakdownRes = await pool.query(`
      SELECT 
        form_type,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN status = 'In Progress' OR status = 'Draft' THEN 1 END)::int AS draft_count,
        COUNT(CASE WHEN status = 'Not Started' THEN 1 END)::int AS not_started_count,
        COUNT(id)::int AS total_submissions
      FROM ri_student_forms
      WHERE ri_batch_id = $1
      GROUP BY form_type
      ORDER BY form_type ASC
    `, [batchId]);

    // 9. Student Feedbacks
    const feedbacksRes = await pool.query(`
      SELECT 
        rfb.*,
        u.name AS student_name,
        u.prn,
        rp.panel_number,
        rp.name AS panel_name,
        rv.name AS village_name
      FROM ri_student_feedbacks rfb
      JOIN users u ON rfb.student_id = u.id
      LEFT JOIN ri_panels rp ON rfb.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rfb.ri_batch_id = $1
      ORDER BY rfb.created_at DESC
      LIMIT 100
    `, [batchId]);

    // 10. Compute High-level Statistics
    const totalStudents = studentsRes.rowCount;
    const submittedUndertakings = studentsRes.rows.filter(s => s.undertaking_status === 'Submitted').length;
    const submittedEvaluations = evaluationsRes.rows.filter(e => e.evaluation_status === 'Submitted' || e.evaluation_status === 'Completed').length;
    const schoolActPresent = studentsRes.rows.filter(s => s.school_activity_attendance === 'Present').length;
    const instVisitPresent = studentsRes.rows.filter(s => s.institutional_visit_attendance === 'Present').length;
    const famSurveyPresent = studentsRes.rows.filter(s => s.family_survey_attendance === 'Present').length;
    const commProjPresent = studentsRes.rows.filter(s => s.community_project_attendance === 'Present').length;

    const stats = {
      total_students: totalStudents,
      total_panels: panelsWithFaculty.length,
      total_villages: villagesWithDetails.length,
      total_faculty: facultyRes.rowCount,
      undertakings_submitted: submittedUndertakings,
      undertakings_pending: Math.max(0, totalStudents - submittedUndertakings),
      undertaking_percentage: totalStudents > 0 ? Math.round((submittedUndertakings / totalStudents) * 100) : 0,
      evaluations_completed: submittedEvaluations,
      evaluations_pending: Math.max(0, totalStudents - submittedEvaluations),
      evaluation_percentage: totalStudents > 0 ? Math.round((submittedEvaluations / totalStudents) * 100) : 0,
      school_activity_present: schoolActPresent,
      institutional_visit_present: instVisitPresent,
      family_survey_present: famSurveyPresent,
      community_project_present: commProjPresent,
      school_activity_rate: totalStudents > 0 ? Math.round((schoolActPresent / totalStudents) * 100) : 0,
      institutional_visit_rate: totalStudents > 0 ? Math.round((instVisitPresent / totalStudents) * 100) : 0,
      family_survey_rate: totalStudents > 0 ? Math.round((famSurveyPresent / totalStudents) * 100) : 0,
      community_project_rate: totalStudents > 0 ? Math.round((commProjPresent / totalStudents) * 100) : 0
    };

    res.json({
      batch,
      stats,
      panels: panelsWithFaculty,
      villages: villagesWithDetails,
      faculty: facultyRes.rows,
      students: studentsRes.rows,
      attendance: attendanceMatrixRes.rows,
      evaluations: evaluationsRes.rows,
      forms_breakdown: formsBreakdownRes.rows,
      feedbacks: feedbacksRes.rows
    });
  } catch (err) {
    console.error('[riSuperAdminController.getRiSuperAdminBatchDetails Error]', err);
    res.status(500).json({ message: 'Failed to fetch batch details', error: err.message });
  }
};

// ─── 4. Get Panel & Faculty Mapping (With Multiple Faculty Support) ───────────
const getPanelFacultyMapping = async (req, res) => {
  try {
    const { batch_id } = req.query;
    let query = `
      SELECT 
        rp.id AS panel_id,
        rp.panel_number,
        rp.name AS panel_name,
        rp.capacity,
        rb.id AS batch_id,
        rb.name AS batch_name,
        COALESCE(rb.batch_code, b.batch_code, CONCAT('RI-', rb.id)) AS batch_code,
        rv.id AS village_id,
        rv.name AS village_name,
        rv.location AS village_location,
        rv.sarpanch_name,
        rv.sarpanch_mobile,
        rv.panchayat,
        rv.district,
        COUNT(DISTINCT rbs.student_id)::int AS student_count
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id
      WHERE rb.status <> 'deleted'
    `;

    const params = [];
    if (batch_id && !isNaN(parseInt(batch_id, 10))) {
      params.push(parseInt(batch_id, 10));
      query += ` AND rb.id = $${params.length}`;
    }

    query += ` GROUP BY rp.id, rb.id, b.batch_code, rv.id ORDER BY rb.id ASC, rp.panel_number ASC`;

    const panelsResult = await pool.query(query, params);

    // Fetch all faculty assignments for these panels
    const facultyQuery = await pool.query(`
      SELECT 
        rbf.id AS assignment_id,
        rbf.ri_batch_id,
        rbf.ri_panel_id,
        rbf.faculty_id,
        rbf.name,
        rbf.email,
        rbf.phone,
        rbf.department,
        rbf.designation,
        rbf.employee_id,
        rbf.role,
        rbf.status,
        COALESCE(
          u.ri_undertaking_submitted,
          EXISTS(
            SELECT 1 FROM ri_faculty_undertakings rfu_sub 
            WHERE (rfu_sub.faculty_id = u.id OR rfu_sub.faculty_id = rbf.faculty_id OR rfu_sub.faculty_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email)))
              AND (rfu_sub.status = 'Submitted' OR rfu_sub.status IS NULL)
          ),
          false
        ) AS undertaking_submitted
      FROM ri_batch_faculty rbf
      LEFT JOIN users u ON (rbf.faculty_id = u.id OR LOWER(rbf.email) = LOWER(u.email))
      WHERE rbf.status <> 'deleted'
      ${batch_id ? `AND rbf.ri_batch_id = ${parseInt(batch_id, 10)}` : ''}
      ORDER BY rbf.name ASC
    `);

    // Fetch students list grouped by panel
    const studentsQuery = await pool.query(`
      SELECT 
        rbs.ri_panel_id,
        u.id AS student_id,
        u.name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number) AS ri_id,
        u.department,
        u.division,
        u.phone,
        (CASE 
          WHEN (ru.id IS NOT NULL AND (ru.status = 'Submitted' OR ru.status = 'approved'))
            OR u.undertaking_submitted = true
            OR u.ri_undertaking_submitted = true
            OR EXISTS (
              SELECT 1 FROM ri_student_forms rsf 
              WHERE rsf.student_id = u.id 
                AND rsf.form_type = 'UNDERTAKING' 
                AND (rsf.status = 'Submitted' OR rsf.status = 'approved' OR rsf.status = 'Reviewed')
            ) THEN 'Submitted'
          ELSE COALESCE(ru.status, 'Pending')
        END) AS undertaking_status
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_undertakings ru ON ru.student_id = u.id
      ${batch_id ? `WHERE rbs.ri_batch_id = ${parseInt(batch_id, 10)}` : ''}
      ORDER BY u.name ASC
    `);

    const facultyByPanel = {};
    facultyQuery.rows.forEach(f => {
      if (!facultyByPanel[f.ri_panel_id]) facultyByPanel[f.ri_panel_id] = [];
      facultyByPanel[f.ri_panel_id].push(f);
    });

    const studentsByPanel = {};
    studentsQuery.rows.forEach(s => {
      if (!studentsByPanel[s.ri_panel_id]) studentsByPanel[s.ri_panel_id] = [];
      studentsByPanel[s.ri_panel_id].push(s);
    });

    const mapping = panelsResult.rows.map(p => ({
      ...p,
      faculty: facultyByPanel[p.panel_id] || [],
      students: studentsByPanel[p.panel_id] || []
    }));

    res.json({ mapping });
  } catch (err) {
    console.error('[riSuperAdminController.getPanelFacultyMapping Error]', err);
    res.status(500).json({ message: 'Failed to fetch panel-faculty mapping', error: err.message });
  }
};

// ─── 5. Get Faculty Management Directory ───────────────────────────────────────
const getFacultyManagement = async (req, res) => {
  try {
    const { batch_id, search, department } = req.query;

    let query = `
      SELECT 
        rbf.email,
        rbf.name,
        COALESCE(rbf.employee_id, u.faculty_id, '') AS employee_id,
        COALESCE(rbf.department, u.department, 'General') AS department,
        COALESCE(rbf.designation, u.designation, 'Faculty') AS designation,
        COALESCE(rbf.phone, u.phone, '') AS phone,
        rbf.status,
        COALESCE(
          u.ri_undertaking_submitted,
          EXISTS(
            SELECT 1 FROM ri_faculty_undertakings rfu_sub 
            WHERE (rfu_sub.faculty_id = u.id OR rfu_sub.faculty_id = rbf.faculty_id OR rfu_sub.faculty_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email)))
              AND (rfu_sub.status = 'Submitted' OR rfu_sub.status IS NULL)
          ),
          false
        ) AS undertaking_submitted,
        (
          SELECT rfu_sub.signed_date FROM ri_faculty_undertakings rfu_sub 
          WHERE (rfu_sub.faculty_id = u.id OR rfu_sub.faculty_id = rbf.faculty_id OR rfu_sub.faculty_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email)))
          ORDER BY rfu_sub.created_at DESC LIMIT 1
        ) AS undertaking_signed_date,
        (
          SELECT rfu_sub.signed_name FROM ri_faculty_undertakings rfu_sub 
          WHERE (rfu_sub.faculty_id = u.id OR rfu_sub.faculty_id = rbf.faculty_id OR rfu_sub.faculty_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email)))
          ORDER BY rfu_sub.created_at DESC LIMIT 1
        ) AS undertaking_signed_name,
        (
          SELECT rfu_sub.tshirt_size FROM ri_faculty_undertakings rfu_sub 
          WHERE (rfu_sub.faculty_id = u.id OR rfu_sub.faculty_id = rbf.faculty_id OR rfu_sub.faculty_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email)))
          ORDER BY rfu_sub.created_at DESC LIMIT 1
        ) AS tshirt_size,
        u.id AS user_id,
        COUNT(DISTINCT rbf.ri_batch_id)::int AS total_batches_count,
        COUNT(DISTINCT rbf.ri_panel_id)::int AS total_panels_count,
        (SELECT COUNT(DISTINCT rbs.student_id)::int 
         FROM ri_batch_students rbs 
         JOIN ri_batch_faculty sub_rbf ON rbs.ri_panel_id = sub_rbf.ri_panel_id AND rbs.ri_batch_id = sub_rbf.ri_batch_id 
         WHERE LOWER(sub_rbf.email) = LOWER(rbf.email) AND sub_rbf.status <> 'deleted') AS total_students_count,
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'batch_id', rb.id,
            'batch_name', rb.name,
            'batch_code', COALESCE(rb.batch_code, b.batch_code, CONCAT('RI-', rb.id)),
            'panel_id', rp.id,
            'panel_number', rp.panel_number,
            'panel_name', rp.name,
            'village_id', rv.id,
            'village_name', rv.name,
            'role', rbf.role,
            'status', rbf.status
          )
        ) AS assignments
      FROM ri_batch_faculty rbf
      JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      LEFT JOIN users u ON (rbf.faculty_id = u.id OR LOWER(rbf.email) = LOWER(u.email))
      WHERE rbf.status <> 'deleted' AND rb.status <> 'deleted'
    `;

    const params = [];
    if (batch_id && !isNaN(parseInt(batch_id, 10))) {
      params.push(parseInt(batch_id, 10));
      query += ` AND rbf.ri_batch_id = $${params.length}`;
    }

    if (department && department !== 'all') {
      params.push(department.toLowerCase());
      query += ` AND LOWER(COALESCE(rbf.department, u.department, '')) = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.toLowerCase().trim()}%`);
      query += ` AND (LOWER(rbf.name) LIKE $${params.length} OR LOWER(rbf.email) LIKE $${params.length} OR LOWER(COALESCE(rbf.employee_id, u.faculty_id, '')) LIKE $${params.length})`;
    }

    query += ` GROUP BY rbf.email, rbf.name, rbf.faculty_id, rbf.employee_id, u.faculty_id, rbf.department, u.department, rbf.designation, u.designation, rbf.phone, u.phone, rbf.status, u.ri_undertaking_submitted, u.id ORDER BY rbf.name ASC`;

    const result = await pool.query(query, params);

    const departmentsRes = await pool.query(`
      SELECT DISTINCT COALESCE(NULLIF(department, ''), 'General') AS dept 
      FROM ri_batch_faculty 
      WHERE status <> 'deleted'
      ORDER BY dept ASC
    `);

    res.json({
      faculty: result.rows,
      total_count: result.rowCount,
      departments: departmentsRes.rows.map(d => d.dept)
    });
  } catch (err) {
    console.error('[riSuperAdminController.getFacultyManagement Error]', err);
    res.status(500).json({ message: 'Failed to fetch faculty management directory', error: err.message });
  }
};

// ─── 6. Global Search & Filters Across RI ─────────────────────────────────────
const searchRiSuperAdminEntities = async (req, res) => {
  try {
    const { q, entity_type } = req.query;
    const queryTerm = q ? `%${q.toLowerCase().trim()}%` : null;

    if (!queryTerm) {
      return res.json({ results: { batches: [], panels: [], villages: [], faculty: [], students: [] } });
    }

    const results = {};

    // 1. Batches
    if (!entity_type || entity_type === 'all' || entity_type === 'batches') {
      const bRes = await pool.query(`
        SELECT rb.id, rb.name, COALESCE(rb.batch_code, b.batch_code) AS batch_code, rb.status, rb.source_program
        FROM ri_batches rb
        LEFT JOIN batches b ON rb.source_batch_id = b.id
        WHERE rb.status <> 'deleted' AND (LOWER(rb.name) LIKE $1 OR LOWER(COALESCE(rb.batch_code, '')) LIKE $1)
        LIMIT 10
      `, [queryTerm]);
      results.batches = bRes.rows;
    }

    // 2. Panels
    if (!entity_type || entity_type === 'all' || entity_type === 'panels') {
      const pRes = await pool.query(`
        SELECT rp.id, rp.panel_number, rp.name, rb.name AS batch_name, rv.name AS village_name
        FROM ri_panels rp
        JOIN ri_batches rb ON rp.ri_batch_id = rb.id
        LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
        WHERE rb.status <> 'deleted' AND (LOWER(rp.name) LIKE $1 OR CAST(rp.panel_number AS text) LIKE $1)
        LIMIT 10
      `, [queryTerm]);
      results.panels = pRes.rows;
    }

    // 3. Villages
    if (!entity_type || entity_type === 'all' || entity_type === 'villages') {
      const vRes = await pool.query(`
        SELECT rv.id, rv.name, rv.sarpanch_name, rv.location, rv.district, rb.name AS batch_name
        FROM ri_villages rv
        JOIN ri_batches rb ON rv.ri_batch_id = rb.id
        WHERE rv.status <> 'deleted' AND (LOWER(rv.name) LIKE $1 OR LOWER(COALESCE(rv.sarpanch_name, '')) LIKE $1)
        LIMIT 10
      `, [queryTerm]);
      results.villages = vRes.rows;
    }

    // 4. Faculty
    if (!entity_type || entity_type === 'all' || entity_type === 'faculty') {
      const fRes = await pool.query(`
        SELECT DISTINCT rbf.email, rbf.name, rbf.employee_id, rbf.department, rbf.designation
        FROM ri_batch_faculty rbf
        WHERE rbf.status <> 'deleted' AND (LOWER(rbf.name) LIKE $1 OR LOWER(rbf.email) LIKE $1 OR LOWER(COALESCE(rbf.employee_id, '')) LIKE $1)
        LIMIT 10
      `, [queryTerm]);
      results.faculty = fRes.rows;
    }

    // 5. Students
    if (!entity_type || entity_type === 'all' || entity_type === 'students') {
      const sRes = await pool.query(`
        SELECT u.id, u.name, u.email, u.prn, COALESCE(rbs.ri_id, u.roll_number) AS ri_id, u.department, rb.name AS batch_name, rp.name AS panel_name
        FROM ri_batch_students rbs
        JOIN users u ON rbs.student_id = u.id
        JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
        LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
        WHERE rb.status <> 'deleted' AND (LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1 OR LOWER(COALESCE(u.prn, '')) LIKE $1 OR LOWER(COALESCE(rbs.ri_id, '')) LIKE $1)
        LIMIT 15
      `, [queryTerm]);
      results.students = sRes.rows;
    }

    res.json({ results });
  } catch (err) {
    console.error('[riSuperAdminController.searchRiSuperAdminEntities Error]', err);
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
};

// ─── 7. Export Comprehensive Multi-Sheet Batch Summary Excel ──────────────────
const exportBatchSummaryExcel = async (req, res) => {
  try {
    const { id } = req.params;
    const batchId = parseInt(id, 10);
    if (!batchId) return res.status(400).json({ message: 'Valid Batch ID required' });

    // 1. Batch details
    const batchRes = await pool.query(`
      SELECT rb.*, COALESCE(rb.batch_code, b.batch_code) AS batch_code, b.name AS ltc_name
      FROM ri_batches rb
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      WHERE rb.id = $1
    `, [batchId]);
    if (batchRes.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });
    const batch = batchRes.rows[0];

    // 2. Students Sheet Data
    const studentsRes = await pool.query(`
      SELECT 
        u.prn AS "PRN",
        COALESCE(rbs.ri_id, u.roll_number, '') AS "RI ID",
        u.name AS "Student Name",
        u.email AS "Email",
        u.phone AS "Phone",
        u.gender AS "Gender",
        u.department AS "Department",
        u.division AS "Division",
        rp.panel_number AS "Panel Number",
        rp.name AS "Panel Name",
        rv.name AS "Assigned Village",
        (CASE 
          WHEN (ru.id IS NOT NULL AND (ru.status = 'Submitted' OR ru.status = 'approved'))
            OR u.undertaking_submitted = true
            OR u.ri_undertaking_submitted = true
            OR EXISTS (
              SELECT 1 FROM ri_student_forms rsf 
              WHERE rsf.student_id = u.id 
                AND rsf.form_type = 'UNDERTAKING' 
                AND (rsf.status = 'Submitted' OR rsf.status = 'approved' OR rsf.status = 'Reviewed')
            ) THEN 'Submitted'
          ELSE COALESCE(ru.status, 'Pending')
        END) AS "Undertaking Status",
        COALESCE(ru.signed_date, u.ri_undertaking_signed_date, u.undertaking_signed_date, ru.created_at::text, '') AS "Undertaking Signed Date",
        COALESCE(a1.status, 'Unmarked') AS "School Activity Attendance",
        COALESCE(a2.status, 'Unmarked') AS "Institutional Visit Attendance",
        COALESCE(a3.status, 'Unmarked') AS "Family Visit Attendance",
        COALESCE(a4.status, 'Unmarked') AS "Community Project Attendance",
        COALESCE(re.total_marks, 0) AS "Evaluation Marks",
        COALESCE(re.overall_grade, 'N/A') AS "Grade",
        COALESCE(re.evaluation_status, 'Pending') AS "Evaluation Status"
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      LEFT JOIN ri_undertakings ru ON ru.student_id = u.id
      LEFT JOIN ri_attendance a1 ON a1.student_id = u.id AND a1.ri_batch_id = $1 AND a1.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance a2 ON a2.student_id = u.id AND a2.ri_batch_id = $1 AND a2.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance a3 ON a3.student_id = u.id AND a3.ri_batch_id = $1 AND a3.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance a4 ON a4.student_id = u.id AND a4.ri_batch_id = $1 AND a4.activity = 'COMMUNITY_PROJECT'
      LEFT JOIN ri_evaluations re ON re.student_id = u.id AND re.ri_batch_id = $1
      WHERE rbs.ri_batch_id = $1
      ORDER BY rp.panel_number ASC, u.roll_number ASC, u.name ASC
    `, [batchId]);

    // 3. Faculty Sheet Data
    const facultyRes = await pool.query(`
      SELECT 
        rbf.name AS "Faculty Name",
        rbf.email AS "Email",
        rbf.employee_id AS "Employee ID",
        rbf.department AS "Department",
        rbf.designation AS "Designation",
        rbf.phone AS "Contact Number",
        rbf.role AS "RI Role",
        rp.panel_number AS "Assigned Panel",
        rv.name AS "Assigned Village",
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_panel_id = rbf.ri_panel_id AND rbs.ri_batch_id = $1) AS "Students Count",
        rbf.status AS "Status"
      FROM ri_batch_faculty rbf
      LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rbf.ri_batch_id = $1 AND rbf.status <> 'deleted'
      ORDER BY rp.panel_number ASC, rbf.name ASC
    `, [batchId]);

    // 4. Panel & Village Allocation Sheet Data
    const panelAllocRes = await pool.query(`
      SELECT 
        rp.panel_number AS "Panel Number",
        rp.name AS "Panel Name",
        rp.capacity AS "Capacity",
        rv.name AS "Village Name",
        rv.location AS "Location",
        rv.sarpanch_name AS "Sarpanch Name",
        rv.sarpanch_mobile AS "Sarpanch Mobile",
        rv.panchayat AS "Panchayat",
        rv.district AS "District",
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_panel_id = rp.id AND rbs.ri_batch_id = $1) AS "Enrolled Students",
        (SELECT STRING_AGG(rbf.name, ', ') FROM ri_batch_faculty rbf WHERE rbf.ri_panel_id = rp.id AND rbf.ri_batch_id = $1 AND rbf.status <> 'deleted') AS "Assigned Faculty"
      FROM ri_panels rp
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rp.ri_batch_id = $1
      ORDER BY rp.panel_number ASC
    `, [batchId]);

    // 5. Attendance Sheet Data
    const attendanceRes = await pool.query(`
      SELECT 
        u.prn AS "PRN",
        u.name AS "Student Name",
        rp.panel_number AS "Panel",
        rv.name AS "Village",
        ra.activity AS "Activity",
        ra.date AS "Date",
        ra.status AS "Status",
        ra.marked_by_email AS "Marked By",
        ra.created_at AS "Timestamp"
      FROM ri_attendance ra
      JOIN users u ON ra.student_id = u.id
      JOIN ri_panels rp ON ra.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE ra.ri_batch_id = $1
      ORDER BY rp.panel_number ASC, u.name ASC, ra.activity ASC
    `, [batchId]);

    // 6. Evaluations Sheet Data
    const evalRes = await pool.query(`
      SELECT 
        u.prn AS "PRN",
        u.name AS "Student Name",
        u.department AS "Department",
        rp.panel_number AS "Panel",
        rv.name AS "Village",
        re.evaluator_faculty_email AS "Evaluator",
        re.attendance_marks AS "Attendance (15)",
        re.institutional_visit_marks AS "Institutional Visit (10)",
        re.family_survey_marks AS "Family Visit (10)",
        re.community_project_marks AS "Community Project (10)",
        re.problem_statement_marks AS "Problem Statement & SDGs (15)",
        COALESCE(re.smart_solution_marks, re.problem_solution_marks) AS "Proposed Smart Solution (40)",
        re.total_marks AS "Total Marks (100)",
        re.overall_grade AS "Grade",
        re.evaluation_status AS "Status",
        re.faculty_remarks AS "Remarks"
      FROM ri_evaluations re
      JOIN users u ON re.student_id = u.id
      JOIN ri_panels rp ON re.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE re.ri_batch_id = $1
      ORDER BY rp.panel_number ASC, u.name ASC
    `, [batchId]);

    // Build Excel Workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary KPI Sheet
    const summaryData = [
      { Metric: 'Batch Name', Value: batch.name },
      { Metric: 'Batch Code', Value: batch.batch_code || `RI-${batch.id}` },
      { Metric: 'Source Program', Value: batch.source_program || 'RI' },
      { Metric: 'Status', Value: batch.status },
      { Metric: 'Start Date', Value: batch.start_date || 'N/A' },
      { Metric: 'End Date', Value: batch.end_date || 'N/A' },
      { Metric: 'Total Students', Value: studentsRes.rowCount },
      { Metric: 'Total Panels', Value: panelAllocRes.rowCount },
      { Metric: 'Total Faculty Assigned', Value: facultyRes.rowCount },
      { Metric: 'Export Generated At', Value: new Date().toISOString() }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Batch Overview');

    // Sheet 2: Students
    const wsStudents = XLSX.utils.json_to_sheet(studentsRes.rows.length > 0 ? studentsRes.rows : [{ Status: 'No students enrolled' }]);
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Students Roster');

    // Sheet 3: Panels & Villages
    const wsPanels = XLSX.utils.json_to_sheet(panelAllocRes.rows.length > 0 ? panelAllocRes.rows : [{ Status: 'No panels configured' }]);
    XLSX.utils.book_append_sheet(wb, wsPanels, 'Panels & Villages');

    // Sheet 4: Faculty
    const wsFaculty = XLSX.utils.json_to_sheet(facultyRes.rows.length > 0 ? facultyRes.rows : [{ Status: 'No faculty assigned' }]);
    XLSX.utils.book_append_sheet(wb, wsFaculty, 'Faculty Mentors');

    // Sheet 5: Attendance
    const wsAtt = XLSX.utils.json_to_sheet(attendanceRes.rows.length > 0 ? attendanceRes.rows : [{ Status: 'No attendance records' }]);
    XLSX.utils.book_append_sheet(wb, wsAtt, 'Attendance Log');

    // Sheet 6: Evaluations
    const wsEval = XLSX.utils.json_to_sheet(evalRes.rows.length > 0 ? evalRes.rows : [{ Status: 'No evaluation records' }]);
    XLSX.utils.book_append_sheet(wb, wsEval, 'Evaluations');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `RI_Batch_${batch.id}_${(batch.batch_code || batch.name).replace(/[^a-zA-Z0-9-_]/g, '_')}_Summary.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) {
    console.error('[riSuperAdminController.exportBatchSummaryExcel Error]', err);
    res.status(500).json({ message: 'Failed to generate Excel export', error: err.message });
  }
};

// ─── 8. Read-Only Super Admins Management ────────────────────────────────────
const getRiReadOnlySuperAdmins = async (req, res) => {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);`);

    const result = await pool.query(`
      SELECT 
        id, 
        name, 
        email, 
        employee_id, 
        role, 
        department, 
        status, 
        created_at 
      FROM users 
      WHERE role IN ('superadmin_ri_readonly', 'superadmin-ri-readonly')
      ORDER BY created_at DESC, name ASC
    `);

    return res.json({ success: true, readonly_admins: result.rows });
  } catch (err) {
    console.error('[riSuperAdminController.getRiReadOnlySuperAdmins Error]', err);
    return res.status(500).json({ message: 'Failed to load read-only super admins', error: err.message });
  }
};

const createRiReadOnlySuperAdmin = async (req, res) => {
  const { name, email, employee_id, password } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  if (!employee_id || !employee_id.trim()) {
    return res.status(400).json({ message: 'Employee ID is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const cleanEmpId = employee_id.trim();
  const defaultPassword = password && password.trim() ? password.trim() : 'Pppp0000@';

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);`);

    const existing = await pool.query('SELECT id, role, email FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rowCount > 0) {
      const user = existing.rows[0];
      const updateRes = await pool.query(`
        UPDATE users 
        SET role = 'superadmin_ri_readonly', employee_id = $1, name = $2, status = 'active'
        WHERE id = $3
        RETURNING id, name, email, employee_id, role, department, status, created_at
      `, [cleanEmpId, cleanName, user.id]);

      writeAuditLog(req.user.id, 'RI_READONLY_SUPERADMIN_ASSIGNED', `Updated ${cleanEmail} to RI Read-Only Super Admin`, {
        user_id: user.id,
        email: cleanEmail,
        employee_id: cleanEmpId
      });

      return res.status(200).json({
        success: true,
        message: `Super Admin ${cleanName} is now configured with viewing access.`,
        user: updateRes.rows[0]
      });
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const insertRes = await pool.query(`
      INSERT INTO users (name, email, password, role, employee_id, status, permissions)
      VALUES ($1, $2, $3, 'superadmin_ri_readonly', $4, 'active', '[]'::jsonb)
      RETURNING id, name, email, employee_id, role, department, status, created_at
    `, [cleanName, cleanEmail, hashedPassword, cleanEmpId]);

    writeAuditLog(req.user.id, 'RI_READONLY_SUPERADMIN_CREATED', `Created RI Read-Only Super Admin ${cleanEmail}`, {
      user_id: insertRes.rows[0].id,
      email: cleanEmail,
      employee_id: cleanEmpId
    });

    return res.status(201).json({
      success: true,
      message: `Super Admin ${cleanName} added successfully.`,
      user: insertRes.rows[0]
    });
  } catch (err) {
    console.error('[riSuperAdminController.createRiReadOnlySuperAdmin Error]', err);
    return res.status(500).json({ message: 'Failed to create read-only super admin', error: err.message });
  }
};

const deleteRiReadOnlySuperAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    const userRes = await pool.query('SELECT id, name, email, role, base_role FROM users WHERE id = $1', [id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userRes.rows[0];

    // If user was created solely as a superadmin_ri_readonly account or test account, delete the user record
    if (user.role === 'superadmin_ri_readonly' && (!user.base_role || user.base_role === 'superadmin_ri_readonly')) {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    } else {
      const targetRole = user.base_role || 'ri_faculty';
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', [targetRole, id]);
    }

    writeAuditLog(req.user.id, 'RI_READONLY_SUPERADMIN_REMOVED', `Revoked RI Super Admin access from ${user.email}`, {
      user_id: id,
      email: user.email
    });

    return res.json({
      success: true,
      message: `Super Admin access revoked for ${user.name || user.email}.`
    });
  } catch (err) {
    console.error('[riSuperAdminController.deleteRiReadOnlySuperAdmin Error]', err);
    return res.status(500).json({ message: 'Failed to remove read-only super admin access', error: err.message });
  }
};

const changeRiSuperAdminPassword = async (req, res) => {
  const userRole = (req.user?.role || '').toLowerCase();
  if (!userRole.includes('readonly')) {
    return res.status(403).json({ message: 'Password change is only available for read-only super admin accounts.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
  }
  try {
    const userRes = await pool.query('SELECT id, email, password FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = userRes.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

    writeAuditLog(req.user.id, 'PASSWORD_CHANGED', `User ${user.email} updated account password`);

    return res.json({
      success: true,
      message: 'Account password updated successfully.'
    });
  } catch (err) {
    console.error('[riSuperAdminController.changeRiSuperAdminPassword Error]', err);
    return res.status(500).json({ message: 'Failed to update password', error: err.message });
  }
};

// ─── 10. Super Admin: Manage Attendance — Panels Grid with Status & Locks ─────
const getBatchAttendancePanels = async (req, res) => {
  try {
    const requestedBatchId = req.query.batch_id;
    let batchQuery = `SELECT id, name, batch_code, status, start_date, end_date FROM ri_batches WHERE status = 'active' ORDER BY id DESC LIMIT 1`;
    let batchParams = [];
    if (requestedBatchId && requestedBatchId !== 'all') {
      batchQuery = `SELECT id, name, batch_code, status, start_date, end_date FROM ri_batches WHERE id = $1 LIMIT 1`;
      batchParams = [requestedBatchId];
    }
    const batchRes = await pool.query(batchQuery, batchParams);
    if (batchRes.rowCount === 0) {
      const fallbackBatchRes = await pool.query(`SELECT id, name, batch_code, status, start_date, end_date FROM ri_batches ORDER BY id DESC LIMIT 1`);
      if (fallbackBatchRes.rowCount === 0) {
        return res.json({ success: true, batch: null, panels: [] });
      }
      batchRes.rows = fallbackBatchRes.rows;
    }
    const batch = batchRes.rows[0];

    const panelsRes = await pool.query(`
      SELECT 
        rp.id,
        rp.panel_number,
        rp.name,
        rp.school,
        rp.department,
        v.id AS village_id,
        v.name AS village_name,
        v.location AS village_location,
        v.google_maps_link AS village_maps,
        (
          SELECT COUNT(*)::int 
          FROM ri_batch_students rbs 
          WHERE rbs.ri_panel_id = rp.id AND rbs.ri_batch_id = $1
        ) AS student_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', rbf.id, 'name', rbf.name, 'role', rbf.role, 'email', rbf.email)
              ORDER BY rbf.id ASC
            )
            FROM ri_batch_faculty rbf
            WHERE rbf.ri_panel_id = rp.id AND rbf.status <> 'deleted'
          ),
          '[]'::json
        ) AS assigned_faculty,
        -- School Activity Attendance
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'SCHOOL_ACTIVITY' AND ra.status = 'Present'
        ) AS school_activity_present,
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'SCHOOL_ACTIVITY' AND ra.status = 'Absent'
        ) AS school_activity_absent,
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'SCHOOL_ACTIVITY'
        ) AS school_activity_marked,
        -- Institutional Visit Attendance
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'INSTITUTIONAL_VISIT' AND ra.status = 'Present'
        ) AS institutional_visit_present,
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'INSTITUTIONAL_VISIT' AND ra.status = 'Absent'
        ) AS institutional_visit_absent,
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'INSTITUTIONAL_VISIT'
        ) AS institutional_visit_marked,
        -- Family Visit Attendance
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'FAMILY_SURVEY' AND ra.status = 'Present'
        ) AS family_survey_present,
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'FAMILY_SURVEY' AND ra.status = 'Absent'
        ) AS family_survey_absent,
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'FAMILY_SURVEY'
        ) AS family_survey_marked,
        -- Community Project Attendance
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'COMMUNITY_PROJECT' AND ra.status = 'Present'
        ) AS community_project_present,
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'COMMUNITY_PROJECT' AND ra.status = 'Absent'
        ) AS community_project_absent,
        (
          SELECT COUNT(*)::int 
          FROM ri_attendance ra 
          WHERE ra.ri_panel_id = rp.id AND ra.ri_batch_id = $1 AND ra.activity = 'COMMUNITY_PROJECT'
        ) AS community_project_marked,
        -- Locks
        (
          SELECT al.is_locked 
          FROM ri_attendance_locks al 
          WHERE al.ri_panel_id = rp.id AND al.ri_batch_id = $1 AND al.activity = 'SCHOOL_ACTIVITY'
          LIMIT 1
        ) AS school_activity_locked,
        (
          SELECT al.locked_at 
          FROM ri_attendance_locks al 
          WHERE al.ri_panel_id = rp.id AND al.ri_batch_id = $1 AND al.activity = 'SCHOOL_ACTIVITY'
          LIMIT 1
        ) AS school_activity_locked_at,
        (
          SELECT al.is_locked 
          FROM ri_attendance_locks al 
          WHERE al.ri_panel_id = rp.id AND al.ri_batch_id = $1 AND al.activity = 'INSTITUTIONAL_VISIT'
          LIMIT 1
        ) AS institutional_visit_locked,
        (
          SELECT al.locked_at 
          FROM ri_attendance_locks al 
          WHERE al.ri_panel_id = rp.id AND al.ri_batch_id = $1 AND al.activity = 'INSTITUTIONAL_VISIT'
          LIMIT 1
        ) AS institutional_visit_locked_at,
        (
          SELECT al.is_locked 
          FROM ri_attendance_locks al 
          WHERE al.ri_panel_id = rp.id AND al.ri_batch_id = $1 AND al.activity = 'FAMILY_SURVEY'
          LIMIT 1
        ) AS family_survey_locked,
        (
          SELECT al.locked_at 
          FROM ri_attendance_locks al 
          WHERE al.ri_panel_id = rp.id AND al.ri_batch_id = $1 AND al.activity = 'FAMILY_SURVEY'
          LIMIT 1
        ) AS family_survey_locked_at,
        (
          SELECT al.is_locked 
          FROM ri_attendance_locks al 
          WHERE al.ri_panel_id = rp.id AND al.ri_batch_id = $1 AND al.activity = 'COMMUNITY_PROJECT'
          LIMIT 1
        ) AS community_project_locked,
        (
          SELECT al.locked_at 
          FROM ri_attendance_locks al 
          WHERE al.ri_panel_id = rp.id AND al.ri_batch_id = $1 AND al.activity = 'COMMUNITY_PROJECT'
          LIMIT 1
        ) AS community_project_locked_at
      FROM ri_panels rp
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.ri_batch_id = $1
      ORDER BY rp.panel_number ASC
    `, [batch.id]);

    // Fetch authoritative attendance locks for this batch with full metadata
    const batchLocksRes = await pool.query(`
      SELECT al.ri_panel_id, al.activity, al.is_locked, al.locked_at, al.locked_by_email, al.unlocked_until, al.unlocked_at, al.unlocked_by_email, al.lock_reason, u.name as locked_by_name
      FROM ri_attendance_locks al
      LEFT JOIN users u ON al.locked_by_id = u.id
      WHERE al.ri_batch_id = $1
    `, [batch.id]);

    const locksByPanelAndAct = {};
    batchLocksRes.rows.forEach(l => {
      const actKey = normalizeRiActivityKey(l.activity);
      locksByPanelAndAct[`${l.ri_panel_id}_${actKey}`] = l;
    });

    const deadlines = calculateRiVisitDeadlines(batch.start_date, batch.end_date);

    const panels = panelsRes.rows.map(p => {
      const sCount = p.student_count || 0;

      const formatActStats = (actKey, prefix) => {
        const pres = p[`${prefix}_present`] || 0;
        const abs = p[`${prefix}_absent`] || 0;
        const mrk = p[`${prefix}_marked`] || 0;
        const unmrk = Math.max(0, sCount - mrk);
        const lockRow = locksByPanelAndAct[`${p.id}_${actKey}`];
        const effective = computeEffectiveAttendanceLock({
          batchStartDate: batch.start_date,
          batchEndDate: batch.end_date,
          lockRow
        });

        return {
          present: pres,
          absent: abs,
          marked: mrk,
          unmarked: unmrk,
          is_locked: effective.is_locked,
          effective_status: effective.effective_status,
          is_auto_locked: effective.is_auto_locked,
          is_temp_unlocked: effective.is_temp_unlocked,
          temp_unlock_expired: effective.temp_unlock_expired || false,
          unlocked_until: effective.unlocked_until,
          lock_reason: effective.lock_reason,
          locked_at: effective.locked_at,
          locked_by_email: effective.locked_by_email,
          locked_by_name: effective.locked_by_name,
          unlocked_at: effective.unlocked_at,
          unlocked_by_email: effective.unlocked_by_email
        };
      };

      return {
        id: p.id,
        panel_number: p.panel_number,
        name: p.name,
        school: p.school,
        department: p.department,
        village_name: p.village_name || 'Unassigned',
        village_location: p.village_location,
        village_maps: p.village_maps,
        student_count: sCount,
        assigned_faculty: p.assigned_faculty || [],
        activities: {
          SCHOOL_ACTIVITY: formatActStats('SCHOOL_ACTIVITY', 'school_activity'),
          INSTITUTIONAL_VISIT: formatActStats('INSTITUTIONAL_VISIT', 'institutional_visit'),
          FAMILY_SURVEY: formatActStats('FAMILY_SURVEY', 'family_survey'),
          COMMUNITY_PROJECT: formatActStats('COMMUNITY_PROJECT', 'community_project')
        },
        school_activity: formatActStats('SCHOOL_ACTIVITY', 'school_activity'),
        institutional_visit: formatActStats('INSTITUTIONAL_VISIT', 'institutional_visit'),
        family_survey: formatActStats('FAMILY_SURVEY', 'family_survey'),
        community_project: formatActStats('COMMUNITY_PROJECT', 'community_project')
      };
    });

    res.json({
      success: true,
      batch,
      deadlines,
      panels,
      activities: RI_ACTIVITIES
    });
  } catch (err) {
    console.error('[riSuperAdminController.getBatchAttendancePanels Error]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch batch attendance panels', error: err.message });
  }
};

// ─── 11. Super Admin: Detailed Panel Multi-Activity Attendance View ─────────────
const getPanelAttendanceDetail = async (req, res) => {
  try {
    const { batch_id, panel_id } = req.query;
    if (!panel_id) {
      return res.status(400).json({ success: false, message: 'panel_id is required' });
    }

    const panelRes = await pool.query(`
      SELECT 
        rp.id,
        rp.panel_number,
        rp.name,
        rp.school,
        rp.department,
        rp.ri_batch_id,
        rb.name AS batch_name,
        rb.batch_code,
        rb.start_date AS batch_start_date,
        rb.end_date AS batch_end_date,
        v.id AS village_id,
        v.name AS village_name,
        v.location AS village_location,
        v.google_maps_link AS village_maps,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', rbf.id, 'name', rbf.name, 'role', rbf.role, 'email', rbf.email)
              ORDER BY rbf.id ASC
            )
            FROM ri_batch_faculty rbf
            WHERE rbf.ri_panel_id = rp.id AND rbf.status <> 'deleted'
          ),
          '[]'::json
        ) AS assigned_faculty
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1
      LIMIT 1
    `, [panel_id]);

    if (panelRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Panel not found' });
    }
    const panel = panelRes.rows[0];
    const effectiveBatchId = panel.ri_batch_id;

    // Fetch activity locks
    const locksRes = await pool.query(`
      SELECT al.activity, al.is_locked, al.locked_at, al.locked_by_email, al.unlocked_until, al.unlocked_at, al.unlocked_by_email, al.lock_reason, u.name as locked_by_name
      FROM ri_attendance_locks al
      LEFT JOIN users u ON al.locked_by_id = u.id
      WHERE al.ri_batch_id = $1 AND al.ri_panel_id = $2
    `, [effectiveBatchId, panel_id]);

    const deadlines = calculateRiVisitDeadlines(panel.batch_start_date, panel.batch_end_date);

    const locks = {};
    RI_ACTIVITIES.forEach(act => {
      const l = locksRes.rows.find(row => normalizeRiActivityKey(row.activity) === act.key);
      const effective = computeEffectiveAttendanceLock({
        batchStartDate: panel.batch_start_date,
        batchEndDate: panel.batch_end_date,
        lockRow: l
      });
      locks[act.key] = {
        is_locked: effective.is_locked,
        effective_status: effective.effective_status,
        is_auto_locked: effective.is_auto_locked,
        is_temp_unlocked: effective.is_temp_unlocked,
        temp_unlock_expired: effective.temp_unlock_expired || false,
        unlocked_until: effective.unlocked_until,
        lock_reason: effective.lock_reason,
        locked_at: effective.locked_at,
        locked_by_name: effective.locked_by_name || l?.locked_by_name || (effective.locked_by_email ? effective.locked_by_email : (effective.is_locked ? 'System' : null)),
        locked_by_email: effective.locked_by_email,
        unlocked_at: effective.unlocked_at,
        unlocked_by_email: effective.unlocked_by_email
      };
    });

    // Fetch all students in this panel with all 4 activity attendances
    const studentsRes = await pool.query(`
      SELECT 
        u.id AS student_id,
        u.name AS student_name,
        u.name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number, '') AS roll_number,
        rbs.ri_id,
        u.gender,
        u.department,
        u.division,
        u.phone,
        COALESCE(a1.status, 'Unmarked') AS school_activity_status,
        a1.updated_at AS school_activity_marked_at,
        a1.marked_by_email AS school_activity_marked_by,
        a1.remarks AS school_activity_remarks,
        COALESCE(a2.status, 'Unmarked') AS institutional_visit_status,
        a2.updated_at AS institutional_visit_marked_at,
        a2.marked_by_email AS institutional_visit_marked_by,
        a2.remarks AS institutional_visit_remarks,
        COALESCE(a3.status, 'Unmarked') AS family_survey_status,
        a3.updated_at AS family_survey_marked_at,
        a3.marked_by_email AS family_survey_marked_by,
        a3.remarks AS family_survey_remarks,
        COALESCE(a4.status, 'Unmarked') AS community_project_status,
        a4.updated_at AS community_project_marked_at,
        a4.marked_by_email AS community_project_marked_by,
        a4.remarks AS community_project_remarks
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_attendance a1 ON a1.student_id = u.id AND a1.ri_batch_id = $1 AND a1.ri_panel_id = $2 AND a1.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance a2 ON a2.student_id = u.id AND a2.ri_batch_id = $1 AND a2.ri_panel_id = $2 AND a2.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance a3 ON a3.student_id = u.id AND a3.ri_batch_id = $1 AND a3.ri_panel_id = $2 AND a3.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance a4 ON a4.student_id = u.id AND a4.ri_batch_id = $1 AND a4.ri_panel_id = $2 AND a4.activity = 'COMMUNITY_PROJECT'
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      ORDER BY u.name ASC, u.id ASC
    `, [effectiveBatchId, panel_id]);

    const students = studentsRes.rows.map(st => {
      const getCode = (status) => status === 'Present' ? 'P' : (status === 'Absent' ? 'A' : 'Unmarked');
      return {
        ...st,
        name: st.student_name || st.name,
        student_id: st.student_id,
        id: st.student_id,
        school_activity: getCode(st.school_activity_status),
        institutional_visit: getCode(st.institutional_visit_status),
        family_survey: getCode(st.family_survey_status),
        community_project: getCode(st.community_project_status),
        SCHOOL_ACTIVITY: getCode(st.school_activity_status),
        INSTITUTIONAL_VISIT: getCode(st.institutional_visit_status),
        FAMILY_SURVEY: getCode(st.family_survey_status),
        COMMUNITY_PROJECT: getCode(st.community_project_status),
        activities: {
          SCHOOL_ACTIVITY: { status: st.school_activity_status, code: getCode(st.school_activity_status), remarks: st.school_activity_remarks },
          INSTITUTIONAL_VISIT: { status: st.institutional_visit_status, code: getCode(st.institutional_visit_status), remarks: st.institutional_visit_remarks },
          FAMILY_SURVEY: { status: st.family_survey_status, code: getCode(st.family_survey_status), remarks: st.family_survey_remarks },
          COMMUNITY_PROJECT: { status: st.community_project_status, code: getCode(st.community_project_status), remarks: st.community_project_remarks }
        }
      };
    });
    const totalStudents = students.length;

    const computeActivitySummary = (fieldStatus, actKey) => {
      const pres = students.filter(s => s[fieldStatus] === 'Present').length;
      const abs = students.filter(s => s[fieldStatus] === 'Absent').length;
      const unmrk = Math.max(0, totalStudents - pres - abs);
      return {
        key: actKey,
        label: RI_ACTIVITY_LABEL_MAP[actKey] || actKey,
        total_students: totalStudents,
        present: pres,
        absent: abs,
        unmarked: unmrk,
        attendance_percentage: totalStudents > 0 ? Math.round((pres / totalStudents) * 100) : 0,
        is_locked: locks[actKey]?.is_locked === true,
        locked_at: locks[actKey]?.locked_at || null,
        locked_by_name: locks[actKey]?.locked_by_name || null
      };
    };

    const summary = {
      total_students: totalStudents,
      SCHOOL_ACTIVITY: computeActivitySummary('school_activity_status', 'SCHOOL_ACTIVITY'),
      INSTITUTIONAL_VISIT: computeActivitySummary('institutional_visit_status', 'INSTITUTIONAL_VISIT'),
      FAMILY_SURVEY: computeActivitySummary('family_survey_status', 'FAMILY_SURVEY'),
      COMMUNITY_PROJECT: computeActivitySummary('community_project_status', 'COMMUNITY_PROJECT'),
      school_activity: computeActivitySummary('school_activity_status', 'SCHOOL_ACTIVITY'),
      institutional_visit: computeActivitySummary('institutional_visit_status', 'INSTITUTIONAL_VISIT'),
      family_survey: computeActivitySummary('family_survey_status', 'FAMILY_SURVEY'),
      community_project: computeActivitySummary('community_project_status', 'COMMUNITY_PROJECT')
    };

    res.json({
      success: true,
      panel,
      deadlines,
      activities: RI_ACTIVITIES,
      locks,
      summary,
      students
    });
  } catch (err) {
    console.error('[riSuperAdminController.getPanelAttendanceDetail Error]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch panel attendance details', error: err.message });
  }
};

// ─── 12. Super Admin: Save / Modify / Override Panel Attendance ──────────────
const savePanelAttendanceAdmin = async (req, res) => {
  const userRole = (req.user?.role || '').toLowerCase().trim();
  const isReadOnly = userRole.includes('readonly');
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'superadmin-ri' || userRole === 'superadmin_ri';

  if (isReadOnly || !isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden: Read-only super admins cannot modify attendance. Only normal superadmin-ri can modify attendance.' });
  }

  const { batch_id, panel_id, activity, records, attendance, is_locked, lock_action } = req.body;
  const targetActivity = activity || req.body.day || 'SCHOOL_ACTIVITY';
  const normActivity = normalizeRiActivityKey(targetActivity);

  if (!batch_id || !panel_id || !normActivity) {
    return res.status(400).json({ success: false, message: 'batch_id, panel_id, and activity are required.' });
  }

  const recordsList = Array.isArray(records) ? records : (Array.isArray(attendance) ? attendance : []);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let updatedCount = 0;
    if (recordsList.length > 0) {
      for (const rec of recordsList) {
        const studentId = parseInt(rec.student_id || rec.id, 10);
        if (!studentId) continue;
        let rawStatus = rec.status;
        let status = 'Present';
        if (rawStatus === 'P' || rawStatus === 'Present') status = 'Present';
        else if (rawStatus === 'A' || rawStatus === 'Absent') status = 'Absent';
        else if (rawStatus === 'Excused') status = 'Excused';
        else if (rawStatus === 'Approved') status = 'Approved';
        else if (rawStatus === 'Unmarked') status = 'Unmarked';

        const remarks = rec.remarks || null;
        const attDate = req.body.date || rec.date || new Date().toISOString().split('T')[0];

        if (status === 'Unmarked') {
          await client.query(`
            DELETE FROM ri_attendance 
            WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND student_id = $3 AND activity = $4
          `, [batch_id, panel_id, studentId, normActivity]);
        } else {
          await client.query(`
            INSERT INTO ri_attendance (
              ri_batch_id, ri_panel_id, student_id, activity, date,
              status, marked_by_email, marked_by_id, is_locked, remarks, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            ON CONFLICT (ri_batch_id, ri_panel_id, student_id, activity)
            DO UPDATE SET 
              status = EXCLUDED.status,
              date = EXCLUDED.date,
              marked_by_email = EXCLUDED.marked_by_email,
              marked_by_id = EXCLUDED.marked_by_id,
              is_locked = EXCLUDED.is_locked,
              remarks = EXCLUDED.remarks,
              updated_at = NOW()
          `, [batch_id, panel_id, studentId, normActivity, attDate, status, req.user?.email || 'superadmin@ri.edu', req.user?.id || null, is_locked === true, remarks]);
        }
        updatedCount++;
      }
    }

    // Update Lock state if specified
    if (lock_action === 'lock' || is_locked === true) {
      await client.query(`
        INSERT INTO ri_attendance_locks (
          ri_batch_id, ri_panel_id, activity, is_locked, locked_at, locked_by_email, locked_by_id, updated_at
        )
        VALUES ($1, $2, $3, true, NOW(), $4, $5, NOW())
        ON CONFLICT (ri_batch_id, ri_panel_id, activity)
        DO UPDATE SET
          is_locked = true,
          locked_at = NOW(),
          locked_by_email = EXCLUDED.locked_by_email,
          locked_by_id = EXCLUDED.locked_by_id,
          updated_at = NOW()
      `, [batch_id, panel_id, normActivity, req.user?.email || 'superadmin@ri.edu', req.user?.id || null]);
    } else if (lock_action === 'unlock' || is_locked === false) {
      await client.query(`
        INSERT INTO ri_attendance_locks (
          ri_batch_id, ri_panel_id, activity, is_locked, locked_at, locked_by_email, locked_by_id, updated_at
        )
        VALUES ($1, $2, $3, false, NULL, NULL, NULL, NOW())
        ON CONFLICT (ri_batch_id, ri_panel_id, activity)
        DO UPDATE SET
          is_locked = false,
          locked_at = NULL,
          locked_by_email = NULL,
          locked_by_id = NULL,
          updated_at = NOW()
      `, [batch_id, panel_id, normActivity]);
    }

    await client.query('COMMIT');

    writeAuditLog(req.user?.id, 'SUPERADMIN_MODIFY_ATTENDANCE', `Super Admin updated attendance for panel ${panel_id} (${normActivity})`, {
      batch_id,
      panel_id,
      activity: normActivity,
      records_updated: updatedCount,
      lock_action: lock_action || (is_locked ? 'locked' : 'unlocked')
    });

    res.json({
      success: true,
      message: `Successfully saved ${RI_ACTIVITY_LABEL_MAP[normActivity] || normActivity} attendance (${updatedCount} student(s) updated).`,
      updated_count: updatedCount
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[riSuperAdminController.savePanelAttendanceAdmin Error]', err);
    res.status(500).json({ success: false, message: 'Failed to save attendance', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 13. Super Admin: Toggle Panel Attendance Lock (Permanent & Temporary) ───
const togglePanelAttendanceLock = async (req, res) => {
  const userRole = (req.user?.role || '').toLowerCase().trim();
  const isReadOnly = userRole.includes('readonly');
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'superadmin-ri' || userRole === 'superadmin_ri';

  if (isReadOnly || !isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden: Read-only super admins cannot lock or unlock attendance. Only normal superadmin-ri can modify attendance.' });
  }

  const { batch_id, panel_id, activity, is_locked, lock, unlocked_until, action, reason, all_activities } = req.body;

  if (!panel_id) {
    return res.status(400).json({ success: false, message: 'panel_id is required.' });
  }

  try {
    // Resolve canonical batch ID from panel to guard against stale UI batch selection
    const panelCheck = await pool.query('SELECT ri_batch_id FROM ri_panels WHERE id = $1', [panel_id]);
    if (panelCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Panel not found.' });
    }
    const canonicalBatchId = panelCheck.rows[0].ri_batch_id || batch_id;

    // Determine target activities
    const isAllActivities = activity === 'ALL' || all_activities === true;
    let targetActivities = [];
    if (isAllActivities) {
      targetActivities = ['SCHOOL_ACTIVITY', 'INSTITUTIONAL_VISIT', 'FAMILY_SURVEY', 'COMMUNITY_PROJECT'];
    } else {
      const targetActivity = activity || req.body.day || 'SCHOOL_ACTIVITY';
      const normActivity = normalizeRiActivityKey(targetActivity);
      if (!normActivity) {
        return res.status(400).json({ success: false, message: 'Valid activity is required.' });
      }
      targetActivities = [normActivity];
    }

    const adminEmail = req.user?.email || 'superadmin@ri.edu';
    const adminId = req.user?.id || null;

    // 1. Temporary Unlock Branch
    const isTempUnlockRequested = action === 'temp_unlock' || Boolean(unlocked_until);
    if (isTempUnlockRequested) {
      if (!unlocked_until) {
        return res.status(400).json({ success: false, message: 'unlocked_until date is required for temporary unlock.' });
      }

      let expiryDate = new Date(unlocked_until);
      if (typeof unlocked_until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(unlocked_until.trim())) {
        const parts = unlocked_until.trim().split('-');
        // Explicitly anchor date-only inputs to 23:59:59.999 IST (+05:30), independent of host server timezone
        expiryDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T23:59:59.999+05:30`);
      }
      if (isNaN(expiryDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid temporary unlock expiry date format.' });
      }
      if (expiryDate.getTime() <= Date.now()) {
        return res.status(400).json({ success: false, message: 'Temporary unlock expiry must be in the future.' });
      }

      const formattedExpiry = expiryDate.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) + ' 23:59:59 IST';
      const lockReason = reason || `Temporarily unlocked by Superadmin until ${formattedExpiry}`;

      for (const act of targetActivities) {
        await pool.query(`
          INSERT INTO ri_attendance_locks (
            ri_batch_id, ri_panel_id, activity, is_locked, locked_at, locked_by_email, locked_by_id, unlocked_until, unlocked_at, unlocked_by_email, unlocked_by_id, lock_reason, updated_at
          )
          VALUES ($1, $2, $3, false, NULL, NULL, NULL, $4, NOW(), $5, $6, $7, NOW())
          ON CONFLICT (ri_batch_id, ri_panel_id, activity)
          DO UPDATE SET
            is_locked = false,
            locked_at = NULL,
            locked_by_email = NULL,
            locked_by_id = NULL,
            unlocked_until = EXCLUDED.unlocked_until,
            unlocked_at = NOW(),
            unlocked_by_email = EXCLUDED.unlocked_by_email,
            unlocked_by_id = EXCLUDED.unlocked_by_id,
            lock_reason = EXCLUDED.lock_reason,
            updated_at = NOW()
        `, [canonicalBatchId, panel_id, act, expiryDate.toISOString(), adminEmail, adminId, lockReason]);

        writeAuditLog(req.user?.id, 'TEMP_UNLOCK_PANEL_ATTENDANCE', `Super Admin temporarily unlocked attendance for panel ${panel_id} (${act}) until ${formattedExpiry}`, {
          batch_id: canonicalBatchId,
          panel_id,
          activity: act,
          unlocked_until: expiryDate.toISOString(),
          reason: lockReason
        });
      }

      return res.json({
        success: true,
        message: `Attendance for ${targetActivities.length > 1 ? 'all activities' : (RI_ACTIVITY_LABEL_MAP[targetActivities[0]] || targetActivities[0])} is temporarily unlocked until ${formattedExpiry}.`,
        is_locked: false,
        is_temp_unlocked: true,
        unlocked_until: expiryDate.toISOString(),
        lock_reason: lockReason
      });
    }

    // 2. Permanent Lock / Unlock Branch
    const lockState = (is_locked === true || lock === true);
    if (lockState) {
      const lockReason = reason || 'Locked by Superadmin';
      for (const act of targetActivities) {
        await pool.query(`
          INSERT INTO ri_attendance_locks (
            ri_batch_id, ri_panel_id, activity, is_locked, locked_at, locked_by_email, locked_by_id, unlocked_until, unlocked_at, unlocked_by_email, unlocked_by_id, lock_reason, updated_at
          )
          VALUES ($1, $2, $3, true, NOW(), $4, $5, NULL, NULL, NULL, NULL, $6, NOW())
          ON CONFLICT (ri_batch_id, ri_panel_id, activity)
          DO UPDATE SET
            is_locked = true,
            locked_at = NOW(),
            locked_by_email = EXCLUDED.locked_by_email,
            locked_by_id = EXCLUDED.locked_by_id,
            unlocked_until = NULL,
            lock_reason = EXCLUDED.lock_reason,
            updated_at = NOW()
        `, [canonicalBatchId, panel_id, act, adminEmail, adminId, lockReason]);

        writeAuditLog(req.user?.id, 'LOCK_PANEL_ATTENDANCE', `Super Admin locked attendance for panel ${panel_id} (${act})`, {
          batch_id: canonicalBatchId,
          panel_id,
          activity: act,
          is_locked: true,
          reason: lockReason
        });
      }

      return res.json({
        success: true,
        message: `Attendance for ${targetActivities.length > 1 ? 'all activities' : (RI_ACTIVITY_LABEL_MAP[targetActivities[0]] || targetActivities[0])} is now Locked.`,
        is_locked: true,
        is_temp_unlocked: false,
        lock_reason: lockReason
      });
    } else {
      const lockReason = reason || 'Unlocked by Superadmin';
      for (const act of targetActivities) {
        await pool.query(`
          INSERT INTO ri_attendance_locks (
            ri_batch_id, ri_panel_id, activity, is_locked, locked_at, locked_by_email, locked_by_id, unlocked_until, unlocked_at, unlocked_by_email, unlocked_by_id, lock_reason, updated_at
          )
          VALUES ($1, $2, $3, false, NULL, NULL, NULL, NULL, NOW(), $4, $5, $6, NOW())
          ON CONFLICT (ri_batch_id, ri_panel_id, activity)
          DO UPDATE SET
            is_locked = false,
            locked_at = NULL,
            locked_by_email = NULL,
            locked_by_id = NULL,
            unlocked_until = NULL,
            unlocked_at = NOW(),
            unlocked_by_email = EXCLUDED.unlocked_by_email,
            unlocked_by_id = EXCLUDED.unlocked_by_id,
            lock_reason = EXCLUDED.lock_reason,
            updated_at = NOW()
        `, [canonicalBatchId, panel_id, act, adminEmail, adminId, lockReason]);

        writeAuditLog(req.user?.id, 'UNLOCK_PANEL_ATTENDANCE', `Super Admin unlocked attendance for panel ${panel_id} (${act})`, {
          batch_id: canonicalBatchId,
          panel_id,
          activity: act,
          is_locked: false,
          reason: lockReason
        });
      }

      return res.json({
        success: true,
        message: `Attendance for ${targetActivities.length > 1 ? 'all activities' : (RI_ACTIVITY_LABEL_MAP[targetActivities[0]] || targetActivities[0])} is now Unlocked.`,
        is_locked: false,
        is_temp_unlocked: false,
        lock_reason: lockReason
      });
    }
  } catch (err) {
    console.error('[riSuperAdminController.togglePanelAttendanceLock Error]', err);
    res.status(500).json({ success: false, message: 'Failed to toggle attendance lock', error: err.message });
  }
};

// ─── 14. Super Admin: Get Batch Evaluation Panels & Lock Status ───────────────
const getBatchEvaluationPanels = async (req, res) => {
  try {
    const { batch_id } = req.query;
    let targetBatchId = batch_id ? parseInt(batch_id, 10) : null;

    let batch = null;
    if (targetBatchId) {
      const bRes = await pool.query(`SELECT id, name, batch_code, status, start_date, end_date FROM ri_batches WHERE id = $1`, [targetBatchId]);
      if (bRes.rowCount > 0) batch = bRes.rows[0];
    }
    if (!batch) {
      const bRes = await pool.query(`SELECT id, name, batch_code, status, start_date, end_date FROM ri_batches WHERE status <> 'deleted' ORDER BY status = 'active' DESC, id DESC LIMIT 1`);
      if (bRes.rowCount > 0) batch = bRes.rows[0];
    }
    if (!batch) {
      return res.status(404).json({ success: false, message: 'No active RI batch found' });
    }
    targetBatchId = batch.id;

    const deadlines = calculateRiVisitDeadlines(batch.start_date, batch.end_date);

    const panelsRes = await pool.query(`
      SELECT 
        rp.id,
        rp.panel_number,
        rp.name,
        rp.school,
        rp.department,
        rp.ri_batch_id,
        rb.name AS batch_name,
        rb.batch_code,
        v.id AS village_id,
        v.name AS village_name,
        v.location AS village_location,
        COUNT(DISTINCT rbs.student_id)::int AS student_count,
        COUNT(DISTINCT CASE WHEN e.evaluation_status = 'Completed' THEN e.student_id END)::int AS evaluations_completed,
        COUNT(DISTINCT CASE WHEN e.evaluation_status = 'Draft' THEN e.student_id END)::int AS evaluations_draft,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', rbf.id, 'name', rbf.name, 'role', rbf.role, 'email', rbf.email)
              ORDER BY rbf.id ASC
            )
            FROM ri_batch_faculty rbf
            WHERE rbf.ri_panel_id = rp.id AND rbf.status <> 'deleted'
          ),
          '[]'::json
        ) AS assigned_faculty,
        el.is_locked AS explicit_is_locked,
        el.locked_at,
        el.locked_by_email,
        el.unlocked_at,
        el.unlocked_by_email
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id AND rbs.ri_batch_id = rp.ri_batch_id
      LEFT JOIN ri_evaluations e ON e.student_id = rbs.student_id AND e.ri_batch_id = rp.ri_batch_id
      LEFT JOIN ri_evaluation_locks el ON el.ri_batch_id = rp.ri_batch_id AND el.ri_panel_id = rp.id
      WHERE rp.ri_batch_id = $1
      GROUP BY rp.id, rp.panel_number, rp.name, rp.school, rp.department, rp.ri_batch_id, rb.name, rb.batch_code, v.id, v.name, v.location, el.is_locked, el.locked_at, el.locked_by_email, el.unlocked_at, el.unlocked_by_email
      ORDER BY rp.panel_number ASC, rp.name ASC
    `, [targetBatchId]);

    const panels = panelsRes.rows.map(p => {
      const sCount = p.student_count || 0;
      const comp = p.evaluations_completed || 0;
      const draft = p.evaluations_draft || 0;
      const pending = Math.max(0, sCount - comp - draft);

      let isLocked = false;
      let lockReason = 'Open for Evaluation';

      if (p.explicit_is_locked === false) {
        isLocked = false;
        lockReason = 'Unlocked by Super Admin';
      } else if (p.explicit_is_locked === true) {
        isLocked = true;
        lockReason = 'Locked by Super Admin';
      } else if (deadlines.is_evaluation_locked) {
        isLocked = true;
        lockReason = 'Auto-locked (15-day deadline passed)';
      } else if (sCount > 0 && comp >= sCount) {
        isLocked = true;
        lockReason = 'Completed & Locked by Faculty';
      }

      return {
        id: p.id,
        panel_number: p.panel_number,
        name: p.name,
        school: p.school,
        department: p.department,
        village_name: p.village_name || 'Unassigned',
        village_location: p.village_location,
        student_count: sCount,
        evaluations_completed: comp,
        evaluations_draft: draft,
        evaluations_pending: pending,
        assigned_faculty: p.assigned_faculty || [],
        is_locked: isLocked,
        lock_reason: lockReason,
        is_explicitly_unlocked: p.explicit_is_locked === false,
        is_explicitly_locked: p.explicit_is_locked === true,
        locked_at: p.locked_at,
        locked_by_email: p.locked_by_email,
        unlocked_at: p.unlocked_at,
        unlocked_by_email: p.unlocked_by_email
      };
    });

    res.json({
      success: true,
      batch,
      deadlines,
      panels
    });
  } catch (err) {
    console.error('[riSuperAdminController.getBatchEvaluationPanels Error]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch batch evaluation panels', error: err.message });
  }
};

// ─── 15. Super Admin: Detailed Panel Evaluation Table & Student Scores ──────────
const getPanelEvaluationDetail = async (req, res) => {
  try {
    const { batch_id, panel_id, search } = req.query;
    if (!panel_id) {
      return res.status(400).json({ success: false, message: 'panel_id is required' });
    }

    const panelRes = await pool.query(`
      SELECT 
        rp.id,
        rp.panel_number,
        rp.name,
        rp.school,
        rp.department,
        rp.ri_batch_id,
        rb.id AS batch_id,
        rb.name AS batch_name,
        rb.batch_code,
        rb.start_date,
        rb.end_date,
        rb.status AS batch_status,
        v.id AS village_id,
        v.name AS village_name,
        v.location AS village_location,
        v.google_maps_link AS village_maps,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', rbf.id, 'name', rbf.name, 'role', rbf.role, 'email', rbf.email)
              ORDER BY rbf.id ASC
            )
            FROM ri_batch_faculty rbf
            WHERE rbf.ri_panel_id = rp.id AND rbf.status <> 'deleted'
          ),
          '[]'::json
        ) AS assigned_faculty
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1
      LIMIT 1
    `, [panel_id]);

    if (panelRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Panel not found' });
    }
    const panel = panelRes.rows[0];
    const effectiveBatchId = panel.ri_batch_id;
    const batch = {
      id: effectiveBatchId,
      name: panel.batch_name,
      batch_code: panel.batch_code,
      start_date: panel.start_date,
      end_date: panel.end_date,
      status: panel.batch_status
    };

    // Fetch evaluation lock
    const lockRes = await pool.query(`
      SELECT el.is_locked, el.locked_at, el.locked_by_email, el.unlocked_at, el.unlocked_by_email,
             u1.name AS locked_by_name, u2.name AS unlocked_by_name
      FROM ri_evaluation_locks el
      LEFT JOIN users u1 ON el.locked_by_id = u1.id
      LEFT JOIN users u2 ON el.unlocked_by_id = u2.id
      WHERE el.ri_panel_id = $1 AND (el.ri_batch_id = $2 OR el.ri_batch_id IS NOT NULL)
      ORDER BY (el.ri_batch_id = $2) DESC, el.updated_at DESC
      LIMIT 1
    `, [panel_id, effectiveBatchId]);

    const deadlines = calculateRiVisitDeadlines(batch.start_date, batch.end_date);
    const lockRow = lockRes.rows[0] || null;

    let isPanelLocked = false;
    let lockReason = 'Open for Evaluation';

    if (lockRow?.is_locked === false) {
      isPanelLocked = false;
      lockReason = 'Unlocked by Super Admin';
    } else if (lockRow?.is_locked === true) {
      isPanelLocked = true;
      lockReason = 'Locked by Super Admin';
    } else if (deadlines.is_evaluation_locked) {
      isPanelLocked = true;
      lockReason = 'Auto-locked (15-day deadline passed)';
    }

    // Fetch students with evaluation records
    let query = `
      SELECT 
        u.id AS student_id,
        u.name AS student_name,
        u.prn,
        COALESCE(u.roll_number, rbs.ri_id) AS roll_number,
        rbs.ri_id,
        u.department,
        u.division,
        u.phone AS contact_number,
        u.gender,
        COALESCE(school.status, 'Absent') AS school_status,
        COALESCE(inst.status, 'Absent') AS inst_status,
        COALESCE(fam.status, 'Absent') AS fam_status,
        COALESCE(comm.status, 'Absent') AS comm_status,
        e.id AS evaluation_id,
        e.attendance_marks,
        e.institutional_visit_rating,
        e.institutional_visit_marks,
        e.family_survey_rating,
        e.family_survey_marks,
        e.community_project_rating,
        e.community_project_marks,
        e.problem_statement_marks,
        COALESCE(e.smart_solution_marks, e.problem_solution_marks) AS smart_solution_marks,
        e.total_marks,
        e.overall_grade,
        e.evaluation_status,
        e.faculty_remarks,
        e.submitted_at,
        e.updated_at,
        fac.name AS evaluator_name,
        fac.email AS evaluator_email
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_attendance school ON school.student_id = u.id AND school.ri_batch_id = $1 AND school.ri_panel_id = $2 AND school.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance inst ON inst.student_id = u.id AND inst.ri_batch_id = $1 AND inst.ri_panel_id = $2 AND inst.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance fam ON fam.student_id = u.id AND fam.ri_batch_id = $1 AND fam.ri_panel_id = $2 AND fam.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance comm ON comm.student_id = u.id AND comm.ri_batch_id = $1 AND comm.ri_panel_id = $2 AND comm.activity = 'COMMUNITY_PROJECT'
      LEFT JOIN ri_evaluations e ON e.student_id = u.id AND e.ri_batch_id = $1
      LEFT JOIN users fac ON e.evaluator_faculty_id = fac.id
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
    `;

    const params = [effectiveBatchId, panel_id];
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(u.name) LIKE $3 OR LOWER(u.prn) LIKE $3 OR LOWER(rbs.ri_id) LIKE $3)`;
    }

    query += ` ORDER BY u.roll_number ASC, u.name ASC`;

    const studentsRes = await pool.query(query, params);

    const ATT_MAP = { 4: 15.00, 3: 11.25, 2: 7.50, 1: 3.75, 0: 0.00 };
    const isPresent = (st) => String(st || '').toLowerCase() === 'present' || String(st || '').toLowerCase() === 'p';

    const students = studentsRes.rows.map(row => {
      let presentCount = 0;
      if (isPresent(row.school_status)) presentCount++;
      if (isPresent(row.inst_status)) presentCount++;
      if (isPresent(row.fam_status)) presentCount++;
      if (isPresent(row.comm_status)) presentCount++;

      const autoAttendanceMarks = ATT_MAP[presentCount] ?? Number((presentCount * 3.75).toFixed(2));
      const hasEval = !!row.evaluation_id;

      return {
        ...row,
        present_activities_count: presentCount,
        auto_attendance_marks: autoAttendanceMarks,
        attendance_marks: hasEval && row.attendance_marks !== null && row.attendance_marks !== undefined ? Number(row.attendance_marks) : autoAttendanceMarks,
        has_existing_evaluation: hasEval,
        institutional_visit_rating: row.institutional_visit_rating || '',
        family_survey_rating: row.family_survey_rating || '',
        community_project_rating: row.community_project_rating || '',
        problem_statement_marks: row.problem_statement_marks !== null && row.problem_statement_marks !== undefined ? Number(row.problem_statement_marks) : '',
        smart_solution_marks: row.smart_solution_marks !== null && row.smart_solution_marks !== undefined ? Number(row.smart_solution_marks) : '',
        faculty_remarks: row.faculty_remarks || '',
        evaluation_status: hasEval ? (row.evaluation_status || 'Draft') : 'Not Evaluated',
        is_locked: Boolean(isPanelLocked || (hasEval && row.evaluation_status === 'Completed'))
      };
    });

    const allCompleted = students.length > 0 && students.every(s => s.evaluation_status === 'Completed');
    if (!lockRow && allCompleted) {
      isPanelLocked = true;
      lockReason = 'Completed & Locked by Faculty';
    }

    res.json({
      success: true,
      batch,
      panel,
      deadlines: {
        ...deadlines,
        is_evaluation_locked: isPanelLocked
      },
      lock: {
        is_locked: isPanelLocked,
        lock_reason: lockReason,
        is_explicitly_unlocked: lockRow?.is_locked === false,
        is_explicitly_locked: lockRow?.is_locked === true,
        locked_at: lockRow?.locked_at || null,
        locked_by_name: lockRow?.locked_by_name || lockRow?.locked_by_email || null,
        unlocked_at: lockRow?.unlocked_at || null,
        unlocked_by_name: lockRow?.unlocked_by_name || lockRow?.unlocked_by_email || null
      },
      students,
      total: students.length
    });
  } catch (err) {
    console.error('[riSuperAdminController.getPanelEvaluationDetail Error]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch panel evaluation details', error: err.message });
  }
};

// ─── 16. Super Admin: Toggle Panel Evaluation Lock / Unlock ───────────────────
const togglePanelEvaluationLock = async (req, res) => {
  const userRole = (req.user?.role || '').toLowerCase().trim();
  const isReadOnly = userRole.includes('readonly');
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'superadmin-ri' || userRole === 'superadmin_ri' || userRole === 'ri_admin';

  if (isReadOnly || !isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden: Read-only super admins cannot lock or unlock evaluations.' });
  }

  const { batch_id, panel_id, is_locked, lock } = req.body;
  if (!panel_id) {
    return res.status(400).json({ success: false, message: 'panel_id is required' });
  }

  const lockState = (is_locked === true || lock === true);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Authoritatively resolve panel and its actual batch ID
    const panelRes = await client.query('SELECT id, ri_batch_id FROM ri_panels WHERE id = $1', [panel_id]);
    if (panelRes.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Panel not found' });
    }
    const effectiveBatchId = panelRes.rows[0].ri_batch_id || parseInt(batch_id, 10);

    if (lockState) {
      // LOCK: Set is_locked = true, lock all evaluated students in this panel
      await client.query(`
        INSERT INTO ri_evaluation_locks (
          ri_batch_id, ri_panel_id, is_locked, locked_at, locked_by_email, locked_by_id, updated_at
        ) VALUES ($1, $2, true, NOW(), $3, $4, NOW())
        ON CONFLICT (ri_batch_id, ri_panel_id)
        DO UPDATE SET
          is_locked = true,
          locked_at = NOW(),
          locked_by_email = EXCLUDED.locked_by_email,
          locked_by_id = EXCLUDED.locked_by_id,
          updated_at = NOW()
      `, [effectiveBatchId, panel_id, req.user?.email || 'superadmin@ri.edu', req.user?.id || null]);

      writeAuditLog(req.user?.id, 'LOCK_PANEL_EVALUATION', `Super Admin locked evaluation for panel ${panel_id} in batch ${effectiveBatchId}`, {
        batch_id: effectiveBatchId, panel_id, is_locked: true
      });

      await client.query('COMMIT');
      return res.json({
        success: true,
        is_locked: true,
        message: 'Panel evaluation successfully locked.'
      });
    } else {
      // UNLOCK: Set is_locked = false in ri_evaluation_locks
      // IMPORTANT: Preserve all existing student evaluation records, statuses ('Completed'), marks, ratings, and remarks.
      await client.query(`
        INSERT INTO ri_evaluation_locks (
          ri_batch_id, ri_panel_id, is_locked, unlocked_at, unlocked_by_email, unlocked_by_id, updated_at
        ) VALUES ($1, $2, false, NOW(), $3, $4, NOW())
        ON CONFLICT (ri_batch_id, ri_panel_id)
        DO UPDATE SET
          is_locked = false,
          unlocked_at = NOW(),
          unlocked_by_email = EXCLUDED.unlocked_by_email,
          unlocked_by_id = EXCLUDED.unlocked_by_id,
          updated_at = NOW()
      `, [effectiveBatchId, panel_id, req.user?.email || 'superadmin@ri.edu', req.user?.id || null]);

      // Clear any mismatched or stale lock rows for this panel
      await client.query(`
        UPDATE ri_evaluation_locks 
        SET is_locked = false, unlocked_at = NOW(), updated_at = NOW()
        WHERE ri_panel_id = $1 AND ri_batch_id <> $2
      `, [panel_id, effectiveBatchId]);

      writeAuditLog(req.user?.id, 'UNLOCK_PANEL_EVALUATION', `Super Admin unlocked evaluation for panel ${panel_id} in batch ${effectiveBatchId}`, {
        batch_id: effectiveBatchId, panel_id, is_locked: false
      });

      await client.query('COMMIT');
      return res.json({
        success: true,
        is_locked: false,
        message: 'Panel evaluation unlocked successfully. Faculty can now submit and edit evaluations.'
      });
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[riSuperAdminController.togglePanelEvaluationLock Error]', err);
    res.status(500).json({ success: false, message: 'Failed to toggle evaluation lock', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 17. Super Admin: Unlock Single Student Evaluation ────────────────────────
const unlockSingleStudentEvaluationAdmin = async (req, res) => {
  const userRole = (req.user?.role || '').toLowerCase().trim();
  const isReadOnly = userRole.includes('readonly');
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'superadmin-ri' || userRole === 'superadmin_ri' || userRole === 'ri_admin';

  if (isReadOnly || !isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden: Read-only super admins cannot unlock evaluations.' });
  }

  const { batch_id, panel_id, student_id } = req.body;
  if (!panel_id || !student_id) {
    return res.status(400).json({ success: false, message: 'panel_id and student_id are required' });
  }

  try {
    const panelRes = await pool.query('SELECT id, ri_batch_id FROM ri_panels WHERE id = $1', [panel_id]);
    const effectiveBatchId = panelRes.rowCount > 0 ? panelRes.rows[0].ri_batch_id : parseInt(batch_id, 10);

    // Unlock this specific student's evaluation to Draft
    await pool.query(`
      UPDATE ri_evaluations
      SET evaluation_status = 'Draft', updated_at = NOW()
      WHERE student_id = $1 AND (ri_batch_id = $2 OR ri_panel_id = $3)
      RETURNING *
    `, [student_id, effectiveBatchId, panel_id]);

    // Ensure the panel is marked explicitly unlocked so deadline does not block
    await pool.query(`
      INSERT INTO ri_evaluation_locks (
        ri_batch_id, ri_panel_id, is_locked, unlocked_at, unlocked_by_email, unlocked_by_id, updated_at
      ) VALUES ($1, $2, false, NOW(), $3, $4, NOW())
      ON CONFLICT (ri_batch_id, ri_panel_id)
      DO UPDATE SET
        is_locked = false,
        unlocked_at = NOW(),
        unlocked_by_email = EXCLUDED.unlocked_by_email,
        unlocked_by_id = EXCLUDED.unlocked_by_id,
        updated_at = NOW()
    `, [effectiveBatchId, panel_id, req.user?.email || 'superadmin@ri.edu', req.user?.id || null]);

    writeAuditLog(req.user?.id, 'UNLOCK_STUDENT_EVALUATION', `Super Admin unlocked evaluation for student ${student_id} in panel ${panel_id}`, {
      batch_id, panel_id, student_id
    });

    res.json({
      success: true,
      message: 'Student evaluation successfully unlocked for editing.'
    });
  } catch (err) {
    console.error('[riSuperAdminController.unlockSingleStudentEvaluationAdmin Error]', err);
    res.status(500).json({ success: false, message: 'Failed to unlock student evaluation', error: err.message });
  }
};

// ─── 18. Super Admin: Save / Modify Panel Evaluation Records ──────────────────
const savePanelEvaluationAdmin = async (req, res) => {
  const userRole = (req.user?.role || '').toLowerCase().trim();
  const isReadOnly = userRole.includes('readonly');
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'superadmin-ri' || userRole === 'superadmin_ri' || userRole === 'ri_admin';

  if (isReadOnly || !isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Forbidden: Read-only super admins cannot save evaluations.' });
  }

  const { batch_id, panel_id, evaluations, lock_action } = req.body;
  if (!batch_id || !panel_id) {
    return res.status(400).json({ success: false, message: 'batch_id and panel_id are required' });
  }

  const evalList = Array.isArray(evaluations) ? evaluations : [];
  if (evalList.length === 0) {
    return res.status(400).json({ success: false, message: 'No evaluation records provided' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let updatedCount = 0;

    for (const item of evalList) {
      const studentId = parseInt(item.student_id || item.id, 10);
      if (!studentId) continue;

      const evalStatus = lock_action === 'lock' ? 'Completed' : (item.evaluation_status || item.status || 'Draft');
      const facultyRemarks = item.faculty_remarks || '';

      // Check attendance records for this student
      const attRes = await client.query(`
        SELECT activity, status FROM ri_attendance
        WHERE student_id = $1 AND ri_batch_id = $2
      `, [studentId, batch_id]);

      const schoolStatus = attRes.rows.find(r => r.activity === 'SCHOOL_ACTIVITY')?.status || 'Absent';
      const instStatus = attRes.rows.find(r => r.activity === 'INSTITUTIONAL_VISIT')?.status || 'Absent';
      const famStatus = attRes.rows.find(r => r.activity === 'FAMILY_SURVEY')?.status || 'Absent';
      const commStatus = attRes.rows.find(r => r.activity === 'COMMUNITY_PROJECT')?.status || 'Absent';

      const calc = calculateRiEvaluation({
        school_activity_status: schoolStatus,
        institutional_visit_status: instStatus,
        family_survey_status: famStatus,
        community_project_status: commStatus,
        attendance_marks: item.attendance_marks,
        institutional_visit_rating: item.institutional_visit_rating || item.institutional_visits_rating,
        family_survey_rating: item.family_survey_rating,
        community_project_rating: item.community_project_rating || item.community_projects_rating,
        problem_statement_marks: item.problem_statement_marks !== '' && item.problem_statement_marks !== null && item.problem_statement_marks !== undefined ? Number(item.problem_statement_marks) : 0,
        smart_solution_marks: item.smart_solution_marks !== '' && item.smart_solution_marks !== null && item.smart_solution_marks !== undefined ? Number(item.smart_solution_marks) : 0,
        evaluation_status: evalStatus
      });

      const submittedAt = evalStatus === 'Completed' ? new Date() : null;

      await client.query(`
        INSERT INTO ri_evaluations (
          student_id, ri_batch_id, ri_panel_id,
          evaluator_faculty_id, evaluator_faculty_email,
          attendance_marks,
          institutional_visit_rating, institutional_visit_marks,
          family_survey_rating, family_survey_marks,
          community_project_rating, community_project_marks,
          problem_statement_marks, smart_solution_marks,
          sdg_alignment_score, degree_relevance_score, smart_solution_score,
          joint_assignment_score, presentation_score, understanding_score,
          problem_solution_marks,
          team_collaboration_rating, team_collaboration_marks,
          total_marks, overall_grade, evaluation_status,
          faculty_remarks, correction_request_message,
          submitted_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (student_id, ri_batch_id)
        DO UPDATE SET
          attendance_marks = EXCLUDED.attendance_marks,
          institutional_visit_rating = EXCLUDED.institutional_visit_rating,
          institutional_visit_marks = EXCLUDED.institutional_visit_marks,
          family_survey_rating = EXCLUDED.family_survey_rating,
          family_survey_marks = EXCLUDED.family_survey_marks,
          community_project_rating = EXCLUDED.community_project_rating,
          community_project_marks = EXCLUDED.community_project_marks,
          problem_statement_marks = EXCLUDED.problem_statement_marks,
          smart_solution_marks = EXCLUDED.smart_solution_marks,
          total_marks = EXCLUDED.total_marks,
          overall_grade = EXCLUDED.overall_grade,
          evaluation_status = EXCLUDED.evaluation_status,
          faculty_remarks = EXCLUDED.faculty_remarks,
          submitted_at = COALESCE(EXCLUDED.submitted_at, ri_evaluations.submitted_at),
          updated_at = CURRENT_TIMESTAMP
      `, [
        studentId, batch_id, panel_id, req.user?.id || null, req.user?.email || 'superadmin@ri.edu',
        calc.attendance_marks,
        calc.institutional_visit_rating, calc.institutional_visit_marks,
        calc.family_survey_rating, calc.family_survey_marks,
        calc.community_project_rating, calc.community_project_marks,
        calc.problem_statement_marks,
        calc.smart_solution_marks,
        calc.problem_statement_marks, 0, calc.smart_solution_marks,
        0, 0, 0, calc.smart_solution_marks,
        calc.institutional_visit_rating || 'Good', 0,
        calc.total_marks, calc.overall_grade,
        evalStatus,
        facultyRemarks || null,
        null,
        submittedAt
      ]);
      updatedCount++;
    }

    if (lock_action === 'lock') {
      await client.query(`
        INSERT INTO ri_evaluation_locks (
          ri_batch_id, ri_panel_id, is_locked, locked_at, locked_by_email, locked_by_id, updated_at
        ) VALUES ($1, $2, true, NOW(), $3, $4, NOW())
        ON CONFLICT (ri_batch_id, ri_panel_id)
        DO UPDATE SET
          is_locked = true, locked_at = NOW(), locked_by_email = EXCLUDED.locked_by_email, locked_by_id = EXCLUDED.locked_by_id, updated_at = NOW()
      `, [batch_id, panel_id, req.user?.email || 'superadmin@ri.edu', req.user?.id || null]);
    } else if (lock_action === 'unlock') {
      await client.query(`
        INSERT INTO ri_evaluation_locks (
          ri_batch_id, ri_panel_id, is_locked, unlocked_at, unlocked_by_email, unlocked_by_id, updated_at
        ) VALUES ($1, $2, false, NOW(), $3, $4, NOW())
        ON CONFLICT (ri_batch_id, ri_panel_id)
        DO UPDATE SET
          is_locked = false, unlocked_at = NOW(), unlocked_by_email = EXCLUDED.unlocked_by_email, unlocked_by_id = EXCLUDED.unlocked_by_id, updated_at = NOW()
      `, [batch_id, panel_id, req.user?.email || 'superadmin@ri.edu', req.user?.id || null]);
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      updated_count: updatedCount,
      message: `Successfully saved ${updatedCount} student evaluation(s)${lock_action === 'lock' ? ' and locked as Completed' : ''}.`
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[riSuperAdminController.savePanelEvaluationAdmin Error]', err);
    res.status(500).json({ success: false, message: 'Failed to save evaluations', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 12. RI Batches Management (CRUD, Lock, Status, Export, Hard Copy PDF) ───
const createRiSuperAdminBatch = async (req, res) => {
  const { name, batch_code, location, year, start_date, end_date, capacity, panel_capacity, status, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Batch Name is required.' });
  }
  const cleanName = name.trim();
  try {
    const existing = await pool.query('SELECT id FROM ri_batches WHERE LOWER(name) = LOWER($1) AND status <> $2', [cleanName, 'deleted']);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: `An RI batch with name "${cleanName}" already exists.` });
    }

    let finalCode = batch_code ? batch_code.trim() : '';
    if (!finalCode) {
      const dateForCode = start_date ? new Date(start_date) : new Date();
      const monthStr = String(dateForCode.getMonth() + 1).padStart(2, '0');
      const yearStr = String(dateForCode.getFullYear()).slice(-2);
      const countRes = await pool.query('SELECT COUNT(*)::int as count FROM ri_batches');
      const nextNum = String((countRes.rows[0]?.count || 0) + 1).padStart(2, '0');
      finalCode = `RI-${nextNum}-${monthStr}${yearStr}`;
    }

    const insertRes = await pool.query(`
      INSERT INTO ri_batches (
        name, batch_code, location, year, start_date, end_date, panel_capacity, status, description, source_program, is_locked
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'RI_DIRECT', false)
      RETURNING *
    `, [
      cleanName,
      finalCode,
      location ? location.trim() : null,
      year ? parseInt(year, 10) : null,
      start_date || null,
      end_date || null,
      parseInt(capacity || panel_capacity, 10) || 60,
      status || 'Created',
      description ? description.trim() : null
    ]);

    res.status(201).json({ success: true, message: 'RI Batch created successfully', batch: insertRes.rows[0] });
  } catch (err) {
    console.error('[createRiSuperAdminBatch Error]', err);
    res.status(500).json({ message: 'Failed to create RI Batch', error: err.message });
  }
};

const updateRiSuperAdminBatch = async (req, res) => {
  const { id } = req.params;
  const { name, batch_code, location, year, start_date, end_date, capacity, panel_capacity, status, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Batch Name is required.' });
  }
  const cleanName = name.trim();
  try {
    const existing = await pool.query('SELECT id FROM ri_batches WHERE LOWER(name) = LOWER($1) AND id <> $2 AND status <> $3', [cleanName, id, 'deleted']);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: `Another RI batch with name "${cleanName}" already exists.` });
    }

    const updateRes = await pool.query(`
      UPDATE ri_batches
      SET
        name = $1,
        batch_code = COALESCE($2, batch_code),
        location = $3,
        year = $4,
        start_date = COALESCE($5, start_date),
        end_date = COALESCE($6, end_date),
        panel_capacity = COALESCE($7, panel_capacity),
        status = COALESCE($8, status),
        description = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      cleanName,
      batch_code ? batch_code.trim() : null,
      location !== undefined ? (location ? location.trim() : null) : null,
      year !== undefined ? (year ? parseInt(year, 10) : null) : null,
      start_date || null,
      end_date || null,
      capacity || panel_capacity ? parseInt(capacity || panel_capacity, 10) : null,
      status || null,
      description !== undefined ? (description ? description.trim() : null) : null,
      id
    ]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }

    res.json({ success: true, message: 'RI Batch updated successfully', batch: updateRes.rows[0] });
  } catch (err) {
    console.error('[updateRiSuperAdminBatch Error]', err);
    res.status(500).json({ message: 'Failed to update RI Batch', error: err.message });
  }
};

const lockRiBatch = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE ri_batches SET is_locked = true, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true, message: 'RI Batch locked successfully' });
  } catch (err) {
    console.error('[lockRiBatch Error]', err);
    res.status(500).json({ message: 'Failed to lock RI Batch', error: err.message });
  }
};

const unlockRiBatch = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE ri_batches SET is_locked = false, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true, message: 'RI Batch unlocked successfully' });
  } catch (err) {
    console.error('[unlockRiBatch Error]', err);
    res.status(500).json({ message: 'Failed to unlock RI Batch', error: err.message });
  }
};

const archiveRiBatch = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE ri_batches SET status = 'Archived', updated_at = NOW() WHERE id = $1", [id]);
    res.json({ success: true, message: 'RI Batch archived successfully' });
  } catch (err) {
    console.error('[archiveRiBatch Error]', err);
    res.status(500).json({ message: 'Failed to archive RI Batch', error: err.message });
  }
};

const closeRiBatch = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE ri_batches SET status = 'Completed', updated_at = NOW() WHERE id = $1", [id]);
    res.json({ success: true, message: 'RI Batch marked as Completed' });
  } catch (err) {
    console.error('[closeRiBatch Error]', err);
    res.status(500).json({ message: 'Failed to complete RI Batch', error: err.message });
  }
};

const reopenRiBatch = async (req, res) => {
  const { id } = req.params;
  const targetStatus = req.body?.status || 'Planning';
  try {
    await pool.query("UPDATE ri_batches SET status = $1, updated_at = NOW() WHERE id = $2", [targetStatus, id]);
    res.json({ success: true, message: `RI Batch status updated to ${targetStatus}` });
  } catch (err) {
    console.error('[reopenRiBatch Error]', err);
    res.status(500).json({ message: 'Failed to update RI Batch status', error: err.message });
  }
};

const exportRiBatchCsv = async (req, res) => {
  const { id } = req.params;
  try {
    const batchRes = await pool.query('SELECT * FROM ri_batches WHERE id = $1', [id]);
    if (batchRes.rowCount === 0) return res.status(404).json({ message: 'RI Batch not found' });
    const batch = batchRes.rows[0];

    const studentsRes = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.prn, 
        u.gender, 
        u.department, 
        u.school, 
        rp.name as panel_name, 
        rv.name as village_name, 
        rbs.ri_id,
        (CASE 
          WHEN u.undertaking_submitted = true OR u.ri_undertaking_submitted = true THEN true
          WHEN EXISTS (
            SELECT 1 FROM ri_undertakings ru 
            WHERE ru.student_id = u.id AND (ru.status = 'Submitted' OR ru.status = 'approved')
          ) THEN true
          WHEN EXISTS (
            SELECT 1 FROM ri_student_forms sf 
            WHERE sf.student_id = u.id AND sf.form_type = 'UNDERTAKING' AND (sf.status = 'Submitted' OR sf.status = 'approved')
          ) THEN true
          ELSE false
        END) as has_undertaking
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rbs.ri_batch_id = $1
      ORDER BY COALESCE(NULLIF(TRIM(rp.name), ''), 'Unassigned Panel') ASC, u.name ASC
    `, [id]);

    const facultyRes = await pool.query(`
      SELECT 
        u.id,
        rbf.name,
        rbf.email,
        rbf.department,
        rbf.designation,
        rbf.phone,
        rp.name as panel_name,
        rv.name as village_name
      FROM ri_batch_faculty rbf
      LEFT JOIN users u ON LOWER(u.email) = LOWER(rbf.email)
      LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
      WHERE rbf.ri_batch_id = $1 AND rbf.status <> 'deleted'
      ORDER BY rbf.name ASC
    `, [id]);

    res.json({
      batch: {
        id: batch.id,
        name: batch.name,
        batch_code: batch.batch_code,
        year: batch.year,
        location: batch.location,
        status: batch.status,
        capacity: batch.panel_capacity
      },
      students: studentsRes.rows.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        prn: s.prn,
        gender: s.gender,
        department: s.department,
        school: s.school,
        panel: s.panel_name || 'Unassigned',
        village: s.village_name || 'Unassigned',
        undertaking_status: s.has_undertaking ? 'Submitted' : 'Pending'
      })),
      faculty: facultyRes.rows.map(f => ({
        id: f.id,
        name: f.name,
        email: f.email,
        department: f.department,
        designation: f.designation,
        phone: f.phone,
        panel: f.panel_name || 'Unassigned',
        village: f.village_name || 'Unassigned'
      }))
    });
  } catch (err) {
    console.error('[exportRiBatchCsv Error]', err);
    res.status(500).json({ message: 'Failed to export RI batch data', error: err.message });
  }
};

const getRiBatchHardCopyPdf = async (req, res) => {
  const { id } = req.params;
  try {
    const batchRes = await pool.query('SELECT * FROM ri_batches WHERE id = $1', [id]);
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const batch = batchRes.rows[0];

    const studentsRes = await pool.query(
      `SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.prn, 
        u.gender, 
        u.department, 
        u.school, 
        rp.name as panel_name, 
        rv.name as village_name, 
        rbs.ri_id,
        (CASE 
          WHEN u.undertaking_submitted = true OR u.ri_undertaking_submitted = true THEN true
          WHEN EXISTS (
            SELECT 1 FROM ri_undertakings ru 
            WHERE ru.student_id = u.id AND (ru.status = 'Submitted' OR ru.status = 'approved')
          ) THEN true
          WHEN EXISTS (
            SELECT 1 FROM ri_student_forms sf 
            WHERE sf.student_id = u.id AND sf.form_type = 'UNDERTAKING' AND (sf.status = 'Submitted' OR sf.status = 'approved')
          ) THEN true
          ELSE false
        END) as has_undertaking
       FROM ri_batch_students rbs
       JOIN users u ON rbs.student_id = u.id
       LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
       LEFT JOIN ri_villages rv ON rp.ri_village_id = rv.id
       WHERE rbs.ri_batch_id = $1
       ORDER BY COALESCE(NULLIF(TRIM(rp.name), ''), 'Unassigned Panel') ASC, u.name ASC`,
      [id]
    );

    const students = studentsRes.rows;

    const panelGroups = {};
    students.forEach(s => {
      const panelName = (s.panel_name && s.panel_name.trim()) ? s.panel_name.trim() : 'Unassigned Panel';
      if (!panelGroups[panelName]) {
        panelGroups[panelName] = [];
      }
      panelGroups[panelName].push(s);
    });

    const panelKeys = Object.keys(panelGroups).sort();

    const startDateStr = batch.start_date ? new Date(batch.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const endDateStr = batch.end_date ? new Date(batch.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const puppeteer = require('puppeteer');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${batch.name} - RI Panel Attendance Hard Copy</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 10px;
      line-height: 1.35;
    }
    .panel-section {
      page-break-after: always;
    }
    .panel-section:last-child {
      page-break-after: auto;
    }
    .header-bar {
      border-bottom: 2.5px solid #047857;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .org-title {
      font-size: 14px;
      font-weight: 800;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 3px 0;
    }
    .doc-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .info-table {
      width: 100%;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      margin-bottom: 12px;
      border-collapse: collapse;
    }
    .info-table td {
      padding: 6px 10px;
      font-size: 10px;
    }
    .lbl {
      font-weight: 800;
      color: #065f46;
      text-transform: uppercase;
      font-size: 8.5px;
    }
    .val {
      font-weight: 700;
      color: #0f172a;
    }
    .att-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    .att-table th {
      background-color: #047857;
      color: #ffffff;
      padding: 6px 5px;
      border: 1px solid #047857;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      text-align: center;
      letter-spacing: 0.3px;
    }
    .att-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      vertical-align: middle;
    }
    .att-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .center {
      text-align: center;
    }
    .sign-line {
      border-bottom: 1px dashed #94a3b8;
      height: 14px;
      width: 85%;
      margin: 0 auto;
    }
    .footer-section {
      margin-top: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
      page-break-inside: avoid;
      padding-top: 10px;
      border-top: 1.5px solid #047857;
    }
  </style>
</head>
<body>
  ${panelKeys.length === 0 ? `
    <div class="panel-section">
      <div class="header-bar">
        <div>
          <div class="org-title">MIT World Peace University — Rural Immersion Program</div>
          <div class="doc-title">Panel Attendance Sheet (Hard Copy)</div>
        </div>
        <div style="text-align: right; font-size: 9.5px; color: #64748b; font-weight: 600;">
          Generated: ${todayStr}
        </div>
      </div>
      <table class="info-table">
        <tr>
          <td width="35%"><span class="lbl">Batch Name:</span> <span class="val">${batch.name}</span></td>
          <td width="40%"><span class="lbl">Batch Dates:</span> <span class="val">${startDateStr} – ${endDateStr}</span></td>
          <td width="25%"><span class="lbl">Total Enrolled:</span> <span class="val">0 RI Students</span></td>
        </tr>
      </table>
      <div style="text-align: center; padding: 40px; color: #64748b; font-style: italic;">No RI students enrolled in this batch yet.</div>
    </div>
  ` : panelKeys.map((pName) => {
      const pStudents = panelGroups[pName];
      const villageName = pStudents[0]?.village_name;
      const displayPanel = villageName ? `${pName} (${villageName})` : pName;
      const submittedUndertakings = pStudents.filter(s => s.has_undertaking).length;

      return `
      <div class="panel-section">
        <div class="header-bar">
          <div>
            <div class="org-title">MIT World Peace University — Rural Immersion Program</div>
            <div class="doc-title">PANEL ATTENDANCE SHEET: <span style="color: #047857;">${displayPanel}</span></div>
          </div>
          <div style="text-align: right; font-size: 9.5px; color: #64748b; font-weight: 600;">
            Generated: ${todayStr}
          </div>
        </div>

        <table class="info-table">
          <tr>
            <td width="24%"><span class="lbl">Batch:</span> <span class="val">${batch.name}</span></td>
            <td width="26%"><span class="lbl">Panel:</span> <span class="val" style="color: #047857; font-weight: 800;">${displayPanel}</span></td>
            <td width="24%"><span class="lbl">Dates:</span> <span class="val">${startDateStr} – ${endDateStr}</span></td>
            <td width="13%"><span class="lbl">Students:</span> <span class="val">${pStudents.length}</span></td>
            <td width="13%"><span class="lbl">Undertaking:</span> <span class="val" style="color: #166534;">${submittedUndertakings}/${pStudents.length}</span></td>
          </tr>
        </table>

        <table class="att-table">
          <thead>
            <tr>
              <th width="4%">#</th>
              <th width="16%">PRN / Student ID</th>
              <th width="26%">Student Name</th>
              <th width="8%">Gender</th>
              <th width="13%">Department</th>
              <th width="14%">Undertaking</th>
              <th width="19%">Signature</th>
            </tr>
          </thead>
          <tbody>
            ${pStudents.map((s, idx) => `
              <tr>
                <td class="center" style="font-weight: 700;">${idx + 1}</td>
                <td class="center" style="font-family: monospace; font-weight: 700;">${s.ri_id || s.prn || s.id || 'N/A'}</td>
                <td style="font-weight: 700; color: #0f172a;">${s.name}</td>
                <td class="center" style="text-transform: capitalize;">${s.gender || '—'}</td>
                <td class="center" style="font-weight: 600; color: #065f46; font-size: 8.5px;">${s.department || '—'}</td>
                <td class="center">
                  ${s.has_undertaking 
                    ? '<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 8.5px; background: #dcfce7; color: #166534; border: 1px solid #86efac;">Submitted</span>' 
                    : '<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 8.5px; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;">Pending</span>'}
                </td>
                <td>
                  <div class="sign-line"></div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer-section">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>Bus / Vehicle: ________________________</div>
            <div>Faculty Mentor: ________________________</div>
            <div>Total Present: _________</div>
            <div>Total Absent: _________</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <div>Faculty / Mentor Signature: _______________________</div>
            <div>Date: __________________</div>
          </div>
        </div>
      </div>
    `;
    }).join('')}
</body>
</html>`;

    let browser;
    let pdfBytes;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '8mm', bottom: '10mm', left: '8mm' }
      });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          console.error('[getRiBatchHardCopyPdf Puppeteer Close Error]', closeErr);
        }
      }
    }

    const fileName = `RI_${batch.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_PanelWise_Attendance_HardCopy.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('[getRiBatchHardCopyPdf Error]', err);
    res.status(500).json({ message: 'Failed to generate RI Hard Copy PDF', error: err.message });
  }
};

module.exports = {
  getRiSuperAdminAnalytics,
  getRiSuperAdminBatches,
  getRiSuperAdminBatchDetails,
  getPanelFacultyMapping,
  getFacultyManagement,
  searchRiSuperAdminEntities,
  exportBatchSummaryExcel,
  getRiReadOnlySuperAdmins,
  createRiReadOnlySuperAdmin,
  deleteRiReadOnlySuperAdmin,
  changeRiSuperAdminPassword,
  getBatchAttendancePanels,
  getPanelAttendanceDetail,
  savePanelAttendanceAdmin,
  togglePanelAttendanceLock,
  getBatchEvaluationPanels,
  getPanelEvaluationDetail,
  togglePanelEvaluationLock,
  savePanelEvaluationAdmin,
  unlockSingleStudentEvaluationAdmin,
  createRiSuperAdminBatch,
  updateRiSuperAdminBatch,
  lockRiBatch,
  unlockRiBatch,
  archiveRiBatch,
  closeRiBatch,
  reopenRiBatch,
  exportRiBatchCsv,
  getRiBatchHardCopyPdf
};

