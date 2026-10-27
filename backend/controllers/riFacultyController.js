const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const riStorageService = require('../services/riStorageService');
const { RI_ACTIVITIES, RI_ACTIVITY_KEYS, RI_ACTIVITY_MAP, RI_ACTIVITY_LABEL_MAP } = require('../utils/riConstants');
const { getOrFetchVillageServices } = require('../services/riVillageServices');
const { calculateRiVisitDeadlines, computeEffectiveAttendanceLock } = require('../utils/riEvaluationCalculator');

/**
 * Helper: Resolve and Authorize Faculty Scope (Active Batch & Panel)
 * Enforces that:
 * 1. The faculty has at least one ACTIVE batch.
 * 2. The requested batch_id is in the faculty's active batches.
 * 3. The requested panel_id is assigned to the faculty within that specific batch.
 */
function resolveFacultyScope(req, res, requestedBatchId, requestedPanelId) {
  // If admin preview, allow access
  if (req.isRiAdminPreview) {
    const defaultBatchId = req.activeBatchIds?.[0] || req.assignedBatchIds?.[0] || 1;
    const defaultPanelId = req.assignedPanelIds?.[0] || 1;
    return {
      batchId: requestedBatchId ? parseInt(requestedBatchId, 10) : defaultBatchId,
      panelId: requestedPanelId ? parseInt(requestedPanelId, 10) : defaultPanelId,
      panelsInBatch: req.assignedPanelIds || [],
      isValid: true
    };
  }

  // 1. Check if the faculty has any active or assigned batches
  const availableBatchIds = (req.activeBatchIds && req.activeBatchIds.length > 0)
    ? req.activeBatchIds
    : (req.assignedBatchIds || []);

  if (availableBatchIds.length === 0) {
    res.status(403).json({
      has_active_assignment: false,
      message: 'No active Rural Immersion cohort is currently available for your account.'
    });
    return { isValid: false };
  }

  // 2. Validate requested batch ID or auto-pick the first active/assigned batch
  let targetBatchId = null;
  if (requestedBatchId) {
    const parsedId = parseInt(requestedBatchId, 10);
    if (availableBatchIds.includes(parsedId)) {
      targetBatchId = parsedId;
    } else if (req.assignedBatchIds && req.assignedBatchIds.includes(parsedId)) {
      targetBatchId = parsedId;
    } else {
      // Gracefully fall back to the first available batch instead of 403
      targetBatchId = availableBatchIds[0];
    }
  } else {
    targetBatchId = availableBatchIds[0];
  }

  // 3. Find panels assigned to this faculty specifically in this active batch
  let facultyAssignmentsInBatch = (req.facultyAssignments || []).filter(
    a => a.ri_batch_id === targetBatchId
  );

  // If none in targetBatchId, fallback to any assigned panels
  if (facultyAssignmentsInBatch.length === 0 && (req.facultyAssignments || []).length > 0) {
    targetBatchId = req.facultyAssignments[0].ri_batch_id;
    facultyAssignmentsInBatch = (req.facultyAssignments || []).filter(
      a => a.ri_batch_id === targetBatchId
    );
  }

  const panelsInBatch = facultyAssignmentsInBatch.map(a => a.ri_panel_id);

  if (panelsInBatch.length === 0) {
    res.status(403).json({
      has_active_assignment: false,
      message: 'Unauthorized: You have no panel assignments in the selected active batch.'
    });
    return { isValid: false };
  }

  // 4. Validate requested panel ID or default to the first panel in batch
  let targetPanelId = null;
  if (requestedPanelId) {
    const parsedPanelId = parseInt(requestedPanelId, 10);
    if (!panelsInBatch.includes(parsedPanelId)) {
      res.status(403).json({
        message: 'Unauthorized: You are not assigned to this panel in the selected batch.'
      });
      return { isValid: false };
    }
    targetPanelId = parsedPanelId;
  } else {
    targetPanelId = panelsInBatch[0];
  }

  return {
    batchId: targetBatchId,
    panelId: targetPanelId,
    panelsInBatch,
    isValid: true
  };
}

// (calculateRiVisitDeadlines is imported from ../utils/riEvaluationCalculator to maintain authoritative single source of truth)

/**
 * Helper: Resolve Evaluation Deadlines considering Super Admin explicit panel overrides
 * If Super Admin unlocked the panel in ri_evaluation_locks, is_evaluation_locked is overridden to false.
 * If Super Admin locked the panel in ri_evaluation_locks, is_evaluation_locked is overridden to true.
 */
async function resolvePanelEvaluationDeadlines(batchId, panelId, batchStartDate, batchEndDate) {
  const deadlines = calculateRiVisitDeadlines(batchStartDate, batchEndDate);
  if (batchId && panelId) {
    try {
      const lockRes = await pool.query(
        `SELECT is_locked, locked_at, locked_by_email, unlocked_at, unlocked_by_email 
         FROM ri_evaluation_locks 
         WHERE ri_panel_id = $1 AND (ri_batch_id = $2 OR ri_batch_id IS NOT NULL)
         ORDER BY (ri_batch_id = $2) DESC, updated_at DESC
         LIMIT 1`,
        [panelId, batchId]
      );
      if (lockRes.rowCount > 0) {
        const row = lockRes.rows[0];
        if (row.is_locked === false) {
          // Explicitly unlocked by Super Admin! Overrides deadline lock.
          deadlines.is_evaluation_locked = false;
          deadlines.is_explicitly_unlocked = true;
          deadlines.unlocked_at = row.unlocked_at;
          deadlines.unlocked_by_email = row.unlocked_by_email;
        } else if (row.is_locked === true) {
          // Explicitly locked by Super Admin!
          deadlines.is_evaluation_locked = true;
          deadlines.is_explicitly_locked = true;
          deadlines.locked_at = row.locked_at;
          deadlines.locked_by_email = row.locked_by_email;
        }
      }
    } catch (err) {
      console.warn('Error reading ri_evaluation_locks:', err);
    }
  }
  return deadlines;
}

/**
 * Verifies if panel attendance is complete and locked across all 4 mandatory activities:
 * 1. Every enrolled student in ri_batch_students must have marked attendance (status != 'Unmarked' AND status IS NOT NULL) for each of the 4 activities.
 * 2. Each of the 4 activities must have is_locked = true in ri_attendance_locks.
 */
async function checkPanelAttendanceLocked(dbClient, batchId, panelId) {
  const runner = dbClient || pool;

  // 1. Total enrolled students in panel
  const enrolledRes = await runner.query(`
    SELECT COUNT(*)::int AS count 
    FROM ri_batch_students 
    WHERE ri_batch_id = $1 AND ri_panel_id = $2
  `, [batchId, panelId]);
  const totalEnrolled = enrolledRes.rows[0]?.count || 0;

  // 2. Attendance locks per activity
  const locksRes = await runner.query(`
    SELECT activity, is_locked 
    FROM ri_attendance_locks 
    WHERE ri_batch_id = $1 AND ri_panel_id = $2
  `, [batchId, panelId]);
  const locksMap = {};
  locksRes.rows.forEach(r => {
    locksMap[r.activity] = (r.is_locked === true);
  });

  // 3. Marked attendance count per activity (excluding 'Unmarked' and null)
  const attRes = await runner.query(`
    SELECT 
      ra.activity,
      COUNT(DISTINCT ra.student_id)::int AS marked_count
    FROM ri_attendance ra
    JOIN ri_batch_students rbs ON ra.student_id = rbs.student_id 
      AND ra.ri_batch_id = rbs.ri_batch_id 
      AND ra.ri_panel_id = rbs.ri_panel_id
    WHERE ra.ri_batch_id = $1 AND ra.ri_panel_id = $2
      AND ra.status IS NOT NULL 
      AND ra.status NOT IN ('Unmarked')
    GROUP BY ra.activity
  `, [batchId, panelId]);
  const countsMap = {};
  attRes.rows.forEach(r => {
    countsMap[r.activity] = r.marked_count || 0;
  });

  let lockedActivitiesCount = 0;
  const activitiesStatus = RI_ACTIVITIES.map(act => {
    const isActivityLockRecorded = locksMap[act.key] === true;
    const markedStudents = countsMap[act.key] || 0;
    const isAllStudentsMarked = (totalEnrolled > 0 && markedStudents >= totalEnrolled);
    const isActivityCompleteAndLocked = isActivityLockRecorded && isAllStudentsMarked;

    if (isActivityCompleteAndLocked) {
      lockedActivitiesCount++;
    }

    return {
      key: act.key,
      label: act.label,
      total_students: totalEnrolled,
      marked_students: markedStudents,
      is_locked_in_table: isActivityLockRecorded,
      is_complete_and_locked: isActivityCompleteAndLocked
    };
  });

  const isAttendanceCompleteAndLocked = (totalEnrolled > 0 && lockedActivitiesCount === RI_ACTIVITIES.length);
  const totalMarkedRecords = activitiesStatus.reduce((acc, a) => acc + (a.marked_students || 0), 0);

  return {
    is_locked: isAttendanceCompleteAndLocked,
    is_attendance_locked: isAttendanceCompleteAndLocked,
    locked_activities_count: lockedActivitiesCount,
    total_activities_count: RI_ACTIVITIES.length,
    total_enrolled: totalEnrolled,
    panel_students_count: totalEnrolled,
    marked_students_count: totalMarkedRecords,
    reason: isAttendanceCompleteAndLocked
      ? 'All mandatory activities completed and locked'
      : (lockedActivitiesCount < RI_ACTIVITIES.length
        ? `${lockedActivitiesCount} of ${RI_ACTIVITIES.length} activities locked`
        : 'Attendance incomplete for one or more students'),
    activities: activitiesStatus
  };
}

/**
 * Verifies submission status of the 6 mandatory RI forms for an array of student IDs in a batch:
 * 1. Student Undertaking
 * 2. Form IIIB - Daily Activity Report
 * 3. Form IV - Institutional Visits
 * 4. Form V - Family Visits
 * 5. Form VI - Problem / Issue Identification & Solution
 * 6. Form VIII - RI Feedback Form
 *
 * Authoritative submission status: status IN ('Submitted', 'Reviewed', 'Completed', 'Approved')
 * Draft, Correction Requested, Incomplete, Not Started, etc. are NOT treated as submitted.
 */
async function checkStudentFormsStatus(dbClient, batchId, studentIds) {
  const runner = dbClient || pool;
  if (!studentIds || studentIds.length === 0) return {};

  const query = `
    SELECT
      rbs.student_id,
      -- 1. Undertaking
      COALESCE(
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = rbs.student_id AND sf.ri_batch_id = $1 AND sf.form_type = 'UNDERTAKING' LIMIT 1),
        CASE WHEN EXISTS (SELECT 1 FROM ri_undertakings ru WHERE ru.student_id = rbs.student_id AND ru.status = 'Submitted') OR u.undertaking_submitted = true THEN 'Submitted'
             WHEN EXISTS (SELECT 1 FROM ri_undertakings ru WHERE ru.student_id = rbs.student_id) THEN 'Draft'
             ELSE 'Not Started' END
      ) AS undertaking_status,

      -- 2. Form IIIB - Daily Activity Report
      COALESCE(
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = rbs.student_id AND sf.ri_batch_id = $1 AND sf.form_type IN ('DAILY_ACTIVITY', 'DAILY_ACTIVITY_REPORT', 'FORM_IIIB') ORDER BY sf.id DESC LIMIT 1),
        (SELECT status FROM ri_daily_activity_reports dar WHERE dar.student_id = rbs.student_id AND dar.ri_batch_id = $1 ORDER BY dar.id DESC LIMIT 1),
        'Not Started'
      ) AS daily_activity_status,

      -- 3. Form IV - Institutional Visits
      COALESCE(
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = rbs.student_id AND sf.ri_batch_id = $1 AND sf.form_type = 'INSTITUTIONAL_VISIT' ORDER BY sf.id DESC LIMIT 1),
        (SELECT status FROM ri_institutional_visits iv WHERE iv.student_id = rbs.student_id AND iv.ri_batch_id = $1 ORDER BY (CASE WHEN iv.status = 'Submitted' THEN 1 ELSE 2 END), iv.id DESC LIMIT 1),
        'Not Started'
      ) AS institutional_status,

      -- 4. Form V - Family Visits
      COALESCE(
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = rbs.student_id AND sf.ri_batch_id = $1 AND sf.form_type = 'FAMILY_SURVEY' ORDER BY sf.id DESC LIMIT 1),
        (SELECT status FROM ri_family_surveys fs WHERE fs.student_id = rbs.student_id AND fs.ri_batch_id = $1 ORDER BY (CASE WHEN fs.status = 'Submitted' THEN 1 ELSE 2 END), fs.id DESC LIMIT 1),
        'Not Started'
      ) AS family_status,

      -- 5. Form VI - Problem / Issue Identification & Solution
      COALESCE(
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = rbs.student_id AND sf.ri_batch_id = $1 AND sf.form_type = 'PROBLEM_IDENTIFICATION' ORDER BY sf.id DESC LIMIT 1),
        (SELECT status FROM ri_problem_identifications pi WHERE pi.student_id = rbs.student_id AND pi.ri_batch_id = $1 ORDER BY pi.id DESC LIMIT 1),
        'Not Started'
      ) AS problem_status,

      -- 6. Form VIII - RI Feedback Form
      COALESCE(
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = rbs.student_id AND sf.ri_batch_id = $1 AND sf.form_type = 'STUDENT_FEEDBACK' ORDER BY sf.id DESC LIMIT 1),
        (SELECT status FROM ri_student_feedbacks fb WHERE fb.student_id = rbs.student_id AND fb.ri_batch_id = $1 ORDER BY fb.id DESC LIMIT 1),
        'Not Started'
      ) AS feedback_status

    FROM ri_batch_students rbs
    JOIN users u ON rbs.student_id = u.id
    WHERE rbs.ri_batch_id = $1 AND rbs.student_id = ANY($2::int[])
  `;

  const res = await runner.query(query, [batchId, studentIds]);

  const SUBMITTED_STATUSES = new Set(['Submitted', 'Reviewed', 'Completed', 'Approved']);
  const isFormSubmitted = (st) => SUBMITTED_STATUSES.has(String(st || '').trim());

  const MANDATORY_FORMS = [
    { key: 'undertaking', label: 'Student Undertaking', check: r => isFormSubmitted(r.undertaking_status), statusKey: 'undertaking_status' },
    { key: 'form_iiib', label: 'Form IIIB — Daily Activity Report', check: r => isFormSubmitted(r.daily_activity_status), statusKey: 'daily_activity_status' },
    { key: 'form_iv', label: 'Form IV — Institutional Visits', check: r => isFormSubmitted(r.institutional_status), statusKey: 'institutional_status' },
    { key: 'form_v', label: 'Form V — Family Visits', check: r => isFormSubmitted(r.family_status), statusKey: 'family_status' },
    { key: 'form_vi', label: 'Form VI — Problem / Issue Identification & Solution', check: r => isFormSubmitted(r.problem_status), statusKey: 'problem_status' },
    { key: 'form_viii', label: 'Form VIII — RI Feedback Form', check: r => isFormSubmitted(r.feedback_status), statusKey: 'feedback_status' }
  ];

  const resultMap = {};
  res.rows.forEach(row => {
    const sId = row.student_id;
    const missingForms = [];
    const statuses = {};

    MANDATORY_FORMS.forEach(form => {
      const isSubmitted = form.check(row);
      statuses[form.key] = {
        label: form.label,
        status: row[form.statusKey] || 'Not Started',
        is_submitted: isSubmitted
      };
      if (!isSubmitted) {
        missingForms.push(form.label);
      }
    });

    resultMap[sId] = {
      student_id: sId,
      forms_completed: missingForms.length === 0,
      is_complete: missingForms.length === 0,
      completed_count: MANDATORY_FORMS.length - missingForms.length,
      missing_forms: missingForms,
      statuses: statuses
    };
  });

  return resultMap;
}

// ─── 1. Get Faculty Profile & Assigned Panels List ───────────────────────────
const getFacultyProfile = async (req, res) => {
  try {
    const userEmail = req.userEmail;

    // Fetch faculty details and all assigned panels with batch info
    const query = `
      SELECT 
        rbf.id as assignment_id,
        rbf.name as faculty_name,
        rbf.email as faculty_email,
        rbf.phone as faculty_phone,
        rbf.department as faculty_department,
        rbf.designation as faculty_designation,
        rbf.employee_id as faculty_employee_id,
        rbf.role as faculty_role,
        rbf.ri_batch_id,
        rb.name as batch_name,
        rb.status as batch_status,
        rb.start_date as batch_start_date,
        rb.end_date as batch_end_date,
        CASE 
          WHEN LOWER(rb.status) NOT IN ('deleted', 'archived') THEN true 
          ELSE false 
        END as is_batch_active,
        rbf.ri_panel_id,
        rp.panel_number,
        rp.name as panel_name,
        rp.name as panel_division,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_panel_id = rp.id) as student_count,
        rp.ri_village_id,
        rp.school as panel_school,
        rp.department as panel_department,
        rp.coordinator_name as panel_coordinator_name,
        rp.class_teacher_name as panel_class_teacher_name,
        v.name as village_name,
        v.location as village_location,
        v.address as village_address,
        v.detailed_address as village_detailed_address,
        v.school_name as village_school_name,
        v.principal_mobile as village_principal_mobile,
        v.spoc_name as village_spoc_name,
        v.spoc_mobile as village_spoc_mobile,
        v.district as village_district,
        v.panchayat as village_panchayat,
        v.taluka as village_taluka,
        v.sarpanch_name,
        v.sarpanch_mobile,
        v.emergency_contact as village_emergency_contact,
        COALESCE(v.google_maps_link, rp.google_maps_link) as google_maps_link,
        v.remark as village_remark,
        v.notes as village_notes
      FROM ri_batch_faculty rbf
      JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
      JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE (rbf.faculty_id = $1 OR LOWER(rbf.email) = $2) AND rbf.status <> 'deleted' AND rb.status <> 'deleted'
      ORDER BY rb.id DESC, rp.panel_number ASC
    `;

    const result = await pool.query(query, [req.user?.id || -1, userEmail]);

    if (result.rowCount === 0 && !req.isRiAdminPreview) {
      return res.status(403).json({
        has_active_assignment: false,
        message: 'No Rural Immersion faculty assignments found for this account.'
      });
    }

    let rows = result.rows;
    let facultyInfo = rows[0] || {
      faculty_name: req.user.name || 'RI Faculty Mentor',
      faculty_email: userEmail,
      faculty_role: 'Mentor',
      faculty_department: req.user.department || 'Rural Immersion Program',
      faculty_designation: 'Faculty Mentor'
    };

    if (req.isRiAdminPreview && rows.length === 0) {
      const adminPanelsRes = await pool.query(`
        SELECT 
          0 as assignment_id,
          rp.id as ri_panel_id,
          rp.panel_number,
          rp.name as panel_name,
          rp.name as panel_division,
          rp.ri_batch_id,
          rb.name as batch_name,
          rb.status as batch_status,
          rb.start_date as batch_start_date,
          rb.end_date as batch_end_date,
          true as is_batch_active,
          (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_panel_id = rp.id) as student_count,
          rp.ri_village_id,
          rp.school as panel_school,
          rp.department as panel_department,
          rp.coordinator_name as panel_coordinator_name,
          rp.class_teacher_name as panel_class_teacher_name,
          v.name as village_name,
          v.location as village_location,
          v.address as village_address,
          v.detailed_address as village_detailed_address,
          v.school_name as village_school_name,
          v.principal_mobile as village_principal_mobile,
          v.spoc_name as village_spoc_name,
          v.spoc_mobile as village_spoc_mobile,
          v.district as village_district,
          v.panchayat as village_panchayat,
          v.taluka as village_taluka,
          v.sarpanch_name,
          v.sarpanch_mobile,
          v.emergency_contact as village_emergency_contact,
          COALESCE(v.google_maps_link, rp.google_maps_link) as google_maps_link,
          v.remark as village_remark,
          v.notes as village_notes
        FROM ri_panels rp
        JOIN ri_batches rb ON rp.ri_batch_id = rb.id
        LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
        WHERE rb.status <> 'deleted'
        ORDER BY rb.id DESC, rp.panel_number ASC
      `);
      rows = adminPanelsRes.rows;
    }

    // Build distinct batch list
    const batchMap = new Map();
    rows.forEach(r => {
      if (!batchMap.has(r.ri_batch_id)) {
        batchMap.set(r.ri_batch_id, {
          id: r.ri_batch_id,
          name: r.batch_name,
          status: r.batch_status,
          start_date: r.batch_start_date,
          end_date: r.batch_end_date,
          is_active: r.is_batch_active
        });
      }
    });

    const allBatches = Array.from(batchMap.values());
    const activeBatches = allBatches.filter(b => b.is_active);
    const validBatches = activeBatches.length > 0 ? activeBatches : allBatches;

    // Determine current active batch
    let selectedBatch = null;
    if (req.query?.batch_id) {
      const requestedId = parseInt(req.query.batch_id, 10);
      selectedBatch = validBatches.find(b => b.id === requestedId) || allBatches.find(b => b.id === requestedId);
    }
    if (!selectedBatch && validBatches.length > 0) {
      selectedBatch = validBatches[0];
    } else if (!selectedBatch && allBatches.length > 0) {
      selectedBatch = allBatches[0];
    }

    // Filter panels for the selected active batch
    const activePanels = selectedBatch 
      ? rows.filter(r => r.ri_batch_id === selectedBatch.id)
      : rows;

    // Check undertaking status for logged-in faculty
    const underCheck = await pool.query(
      `SELECT ri_undertaking_submitted FROM users WHERE id = $1 OR LOWER(email) = $2 LIMIT 1`,
      [req.user?.id || -1, userEmail]
    );
    let isUndertakingSubmitted = Boolean(underCheck.rows[0]?.ri_undertaking_submitted);
    if (!isUndertakingSubmitted) {
      const auditCheck = await pool.query(
        `SELECT 1 FROM ri_faculty_undertakings 
         WHERE faculty_id = $1 OR faculty_id IN (SELECT id FROM users WHERE LOWER(email) = $2)
         LIMIT 1`,
        [req.user?.id || -1, userEmail]
      );
      if (auditCheck.rowCount > 0) {
        isUndertakingSubmitted = true;
      }
    }

    res.json({
      faculty: {
        name: facultyInfo.faculty_name,
        email: facultyInfo.faculty_email,
        phone: facultyInfo.faculty_phone || '',
        department: facultyInfo.faculty_department || '',
        designation: facultyInfo.faculty_designation || '',
        employee_id: facultyInfo.faculty_employee_id || '',
        role: facultyInfo.faculty_role || 'Mentor',
        ri_undertaking_submitted: isUndertakingSubmitted,
        undertaking_submitted: isUndertakingSubmitted
      },
      profile: {
        id: facultyInfo.assignment_id,
        name: facultyInfo.faculty_name,
        email: facultyInfo.faculty_email,
        role: facultyInfo.faculty_role || 'Mentor',
        department: facultyInfo.faculty_department || '',
        designation: facultyInfo.faculty_designation || '',
        employee_id: facultyInfo.faculty_employee_id || '',
        ri_undertaking_submitted: isUndertakingSubmitted,
        undertaking_submitted: isUndertakingSubmitted
      },
      ri_undertaking_submitted: isUndertakingSubmitted,
      undertaking_submitted: isUndertakingSubmitted,
      undertaking_status: { submitted: isUndertakingSubmitted },
      has_active_assignment: Boolean(rows.length > 0 || req.isRiAdminPreview),
      active_batches: validBatches,
      all_batches: allBatches,
      current_batch: selectedBatch,
      assigned_panels: rows,
      batch_panels: activePanels,
      all_assigned_panels: rows,
      total_panels: rows.length
    });
  } catch (err) {
    console.error('Error fetching RI faculty profile:', err);
    res.status(500).json({ message: 'Failed to fetch faculty profile', error: err.message });
  }
};

// ─── 2. Get Faculty Dashboard Overview ───────────────────────────────────────
const getFacultyDashboard = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;

    // Fetch Panel & Village Info strictly scoped to (panelId, batchId)
    const panelQuery = await pool.query(`
      SELECT 
        rp.id as panel_id,
        rp.panel_number,
        rp.name as panel_name,
        rp.name as panel_division,
        rp.ri_batch_id,
        rb.name as batch_name,
        rb.status as batch_status,
        rb.start_date as batch_start_date,
        rb.end_date as batch_end_date,
        rp.ri_village_id,
        rp.school as panel_school,
        rp.department as panel_department,
        rp.coordinator_name as panel_coordinator_name,
        rp.class_teacher_name as panel_class_teacher_name,
        v.name as village_name,
        v.location as village_location,
        v.address as village_address,
        v.detailed_address as village_detailed_address,
        v.school_name as village_school_name,
        v.principal_mobile as village_principal_mobile,
        v.spoc_name as village_spoc_name,
        v.spoc_mobile as village_spoc_mobile,
        v.district as village_district,
        v.panchayat as village_panchayat,
        v.taluka as village_taluka,
        v.sarpanch_name,
        v.sarpanch_mobile,
        v.emergency_contact as village_emergency_contact,
        COALESCE(v.google_maps_link, rp.google_maps_link) as google_maps_link,
        v.remark as village_remark,
        v.notes as village_notes
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);

    if (panelQuery.rowCount === 0) {
      return res.status(404).json({ message: 'Panel not found in this active batch.' });
    }
    const panel = panelQuery.rows[0];

    // Fetch Co-Mentors assigned to this panel in this batch
    const mentorsQuery = await pool.query(`
      SELECT 
        id,
        name,
        email,
        phone,
        department,
        designation,
        employee_id,
        role,
        CASE WHEN LOWER(email) = $3 THEN true ELSE false END as is_current_user
      FROM ri_batch_faculty
      WHERE ri_panel_id = $1 AND ri_batch_id = $2 AND status <> 'deleted'
      ORDER BY role = 'Lead Mentor' DESC, name ASC
    `, [panelId, batchId, req.userEmail]);

    // Fetch Student count & statistics for this panel in this batch
    const studentStatsQuery = await pool.query(`
      SELECT 
        COUNT(*)::int as total_students,
        COUNT(CASE WHEN LOWER(u.gender) = 'female' THEN 1 END)::int as female_count,
        COUNT(CASE WHEN LOWER(u.gender) = 'male' THEN 1 END)::int as male_count,
        COUNT(DISTINCT u.department)::int as department_count
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2
    `, [panelId, batchId]);

    // Real Attendance stats across the 4 activities
    const attStatsQuery = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'Present' THEN 1 END)::int as total_present,
        COUNT(CASE WHEN status = 'Absent' THEN 1 END)::int as total_absent,
        COUNT(CASE WHEN activity = 'SCHOOL_ACTIVITY' AND status = 'Present' THEN 1 END)::int as school_present,
        COUNT(CASE WHEN activity = 'INSTITUTIONAL_VISIT' AND status = 'Present' THEN 1 END)::int as inst_present,
        COUNT(CASE WHEN activity = 'FAMILY_SURVEY' AND status = 'Present' THEN 1 END)::int as fam_present,
        COUNT(CASE WHEN activity = 'COMMUNITY_PROJECT' AND status = 'Present' THEN 1 END)::int as comm_present
      FROM ri_attendance
      WHERE ri_panel_id = $1 AND ri_batch_id = $2
    `, [panelId, batchId]);

    // Real Forms stats from ri_student_forms
    const formsStatsQuery = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status IN ('Submitted', 'Reviewed') THEN 1 END)::int as forms_submitted,
        COUNT(CASE WHEN status IN ('Not Started', 'Draft', 'Requires Correction') THEN 1 END)::int as forms_pending,
        COUNT(CASE WHEN status = 'Requires Correction' THEN 1 END)::int as forms_correction_required
      FROM ri_student_forms
      WHERE ri_panel_id = $1 AND ri_batch_id = $2
    `, [panelId, batchId]);

    // Real Evaluation stats from ri_evaluations
    const evalStatsQuery = await pool.query(`
      SELECT 
        COUNT(CASE WHEN e.evaluation_status = 'Completed' THEN 1 END)::int as evaluations_completed,
        COUNT(CASE WHEN e.evaluation_status IN ('Draft', 'Requires Correction') OR e.evaluation_status IS NULL THEN 1 END)::int as evaluations_pending
      FROM ri_batch_students rbs
      LEFT JOIN ri_evaluations e ON rbs.student_id = e.student_id AND rbs.ri_batch_id = e.ri_batch_id
      WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2
    `, [panelId, batchId]);

    const baseStats = studentStatsQuery.rows[0] || {};
    const attStats = attStatsQuery.rows[0] || {};
    const formsStats = formsStatsQuery.rows[0] || {};
    const evalStats = evalStatsQuery.rows[0] || {};

    const totalStudents = baseStats.total_students || 0;
    const totalPresent = attStats.total_present || 0;
    const totalAbsent = attStats.total_absent || 0;
    const totalPossibleSlots = totalStudents * 4;
    const attendancePct = totalPossibleSlots > 0 ? Math.round((totalPresent / totalPossibleSlots) * 100) : 0;

    // Fetch quick students roster for dashboard overview table
    const dashboardStudentsRes = await pool.query(`
      SELECT 
        u.id as student_id,
        u.name,
        u.prn,
        u.department,
        u.division,
        u.gender,
        COALESCE(u.roll_number, rbs.ri_id) as roll_number,
        rbs.ri_id,
        sch.status as school_status,
        inst.status as inst_status,
        fam.status as fam_status,
        comm.status as comm_status,
        COALESCE(e.evaluation_status, 'Pending') as evaluation_status,
        e.total_marks,
        e.overall_grade
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_attendance sch ON sch.student_id = u.id AND sch.ri_batch_id = $2 AND sch.ri_panel_id = $1 AND sch.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance inst ON inst.student_id = u.id AND inst.ri_batch_id = $2 AND inst.ri_panel_id = $1 AND inst.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance fam ON fam.student_id = u.id AND fam.ri_batch_id = $2 AND fam.ri_panel_id = $1 AND fam.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance comm ON comm.student_id = u.id AND comm.ri_batch_id = $2 AND comm.ri_panel_id = $1 AND comm.activity = 'COMMUNITY_PROJECT'
      LEFT JOIN ri_evaluations e ON e.student_id = u.id AND e.ri_batch_id = $2
      WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2
      ORDER BY u.name ASC
    `, [panelId, batchId]);

    const stats = {
      total_students: totalStudents,
      female_count: baseStats.female_count || 0,
      male_count: baseStats.male_count || 0,
      department_count: baseStats.department_count || 0,
      total_present: totalPresent,
      total_absent: totalAbsent,
      school_present: attStats.school_present || 0,
      inst_present: attStats.inst_present || 0,
      fam_present: attStats.fam_present || 0,
      comm_present: attStats.comm_present || 0,
      attendance_completion_percent: attendancePct,
      forms_submitted: formsStats.forms_submitted || 0,
      forms_pending: formsStats.forms_pending || 0,
      forms_correction_required: formsStats.forms_correction_required || 0,
      evaluations_completed: evalStats.evaluations_completed || 0,
      evaluations_pending: evalStats.evaluations_pending || totalStudents
    };

    const activities = RI_ACTIVITIES.map(a => ({
      key: a.key,
      title: a.label,
      desc: a.description,
      status: 'Active'
    }));

    const rawDeadlines = await resolvePanelEvaluationDeadlines(panel.ri_batch_id, panel.panel_id, panel.batch_start_date, panel.batch_end_date);
    const isAttendanceFullyMarked = totalStudents > 0 && (totalPresent + totalAbsent) >= totalPossibleSlots;
    const isEvaluationFullyMarked = totalStudents > 0 && (evalStats.evaluations_completed || 0) >= totalStudents;
    const showAttendanceReminder = totalStudents > 0 && !isAttendanceFullyMarked;
    const showEvaluationReminder = totalStudents > 0 && !isEvaluationFullyMarked;
    const showReminderBanner = rawDeadlines.has_visit_dates && (showAttendanceReminder || showEvaluationReminder);

    const deadlines = {
      ...rawDeadlines,
      total_students: totalStudents,
      total_possible_slots: totalPossibleSlots,
      total_attendance_marked: totalPresent + totalAbsent,
      evaluations_completed: evalStats.evaluations_completed || 0,
      is_attendance_fully_marked: isAttendanceFullyMarked,
      is_evaluation_fully_marked: isEvaluationFullyMarked,
      show_attendance_reminder: showAttendanceReminder,
      show_evaluation_reminder: showEvaluationReminder,
      show_reminder_banner: showReminderBanner
    };

    res.json({
      batch: {
        id: panel.ri_batch_id,
        name: panel.batch_name,
        status: panel.batch_status,
        start_date: panel.batch_start_date,
        end_date: panel.batch_end_date
      },
      panel,
      mentors: mentorsQuery.rows,
      stats,
      statistics: stats,
      students: dashboardStudentsRes.rows,
      activities,
      deadlines
    });
  } catch (err) {
    console.error('Error fetching RI faculty dashboard:', err);
    res.status(500).json({ message: 'Failed to load dashboard', error: err.message });
  }
};

// ─── 3. Get "My Panel" Detailed View ─────────────────────────────────────────
const getMyPanel = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { search } = req.query;

    const panelQuery = await pool.query(`
      SELECT 
        rp.id as panel_id,
        rp.panel_number,
        rp.name as panel_name,
        rp.name as panel_division,
        rp.ri_batch_id,
        rb.name as batch_name,
        rb.status as batch_status,
        rp.ri_village_id,
        rp.school as panel_school,
        rp.department as panel_department,
        rp.coordinator_name as panel_coordinator_name,
        rp.class_teacher_name as panel_class_teacher_name,
        v.id as village_id,
        v.name as village_name,
        v.location as village_location,
        v.address as village_address,
        v.detailed_address as village_detailed_address,
        v.school_name as village_school_name,
        v.principal_mobile as village_principal_mobile,
        v.spoc_name as village_spoc_name,
        v.spoc_mobile as village_spoc_mobile,
        v.district as village_district,
        v.panchayat as village_panchayat,
        v.taluka as village_taluka,
        v.sarpanch_name,
        v.sarpanch_mobile,
        v.emergency_contact as village_emergency_contact,
        COALESCE(v.google_maps_link, rp.google_maps_link) as google_maps_link,
        v.remark as village_remark,
        v.notes as village_notes
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);

    if (panelQuery.rowCount === 0) {
      return res.status(404).json({ message: 'Panel not found in this batch.' });
    }
    const panel = panelQuery.rows[0];

    const mentorsQuery = await pool.query(`
      SELECT 
        id,
        name,
        email,
        phone,
        department,
        designation,
        employee_id,
        role
      FROM ri_batch_faculty
      WHERE ri_panel_id = $1 AND ri_batch_id = $2 AND status <> 'deleted'
      ORDER BY role = 'Lead Mentor' DESC, name ASC
    `, [panelId, batchId]);

    let studentsQueryStr = `
      SELECT 
        rbs.id as enrollment_id,
        rbs.ri_id,
        rbs.enrolled_at,
        u.id as student_id,
        u.name as student_name,
        u.email as student_email,
        u.prn,
        u.department,
        u.division,
        u.gender,
        u.phone as contact_number,
        u.status as student_status
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2
    `;
    const params = [panelId, batchId];

    if (search && search.trim()) {
      studentsQueryStr += ` AND (
        u.name ILIKE $3 OR 
        u.prn ILIKE $3 OR 
        u.email ILIKE $3 OR 
        u.department ILIKE $3 OR 
        u.division ILIKE $3
      )`;
      params.push(`%${search.trim()}%`);
    }

    studentsQueryStr += ` ORDER BY u.name ASC`;
    const studentsRes = await pool.query(studentsQueryStr, params);

    res.json({
      batch: {
        id: panel.ri_batch_id,
        name: panel.batch_name,
        status: panel.batch_status
      },
      panel,
      village: {
        id: panel.village_id,
        name: panel.village_name || 'Not Assigned',
        location: panel.village_location || '—',
        district: panel.village_district || '—',
        panchayat: panel.village_panchayat || '—',
        sarpanch_name: panel.sarpanch_name || '—',
        sarpanch_mobile: panel.sarpanch_mobile || '—',
        emergency_contact: panel.village_emergency_contact || '—',
        notes: panel.village_notes || ''
      },
      mentors: mentorsQuery.rows,
      students: studentsRes.rows,
      total_students: studentsRes.rows.length
    });
  } catch (err) {
    console.error('Error fetching My Panel in RI Faculty Portal:', err);
    res.status(500).json({ message: 'Failed to load panel details', error: err.message });
  }
};

// ─── 4. Get Panel Students Directory (Paginated & Searchable) ────────────────
const getPanelStudents = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { search, page = 1, limit = 50 } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let whereClause = `WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2`;
    const params = [panelId, batchId];
    let paramIndex = 3;

    if (search && search.trim()) {
      whereClause += ` AND (
        u.name ILIKE $${paramIndex} OR 
        u.prn ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex} OR 
        u.department ILIKE $${paramIndex} OR 
        u.division ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Count query
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total FROM ri_batch_students rbs JOIN users u ON rbs.student_id = u.id ${whereClause}`,
      params
    );
    const totalCount = countRes.rows[0]?.total || 0;

    // Data query
    const dataQuery = `
      SELECT 
        rbs.id as enrollment_id,
        rbs.ri_id,
        u.id as student_id,
        u.name as student_name,
        u.email as student_email,
        u.prn,
        u.department,
        u.division,
        u.gender,
        u.phone as contact_number,
        u.status as student_status,
        rp.panel_number,
        rp.name as panel_name,
        v.name as village_name
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      ${whereClause}
      ORDER BY u.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, parseInt(limit, 10), parseInt(offset, 10)];
    const dataRes = await pool.query(dataQuery, dataParams);

    res.json({
      students: dataRes.rows,
      total: totalCount,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total_pages: Math.max(1, Math.ceil(totalCount / parseInt(limit, 10)))
    });
  } catch (err) {
    console.error('Error fetching panel students:', err);
    res.status(500).json({ message: 'Failed to load panel students', error: err.message });
  }
};

// ─── 5. Get Rural Immersion Activities & Evaluation Framework ───────────────
const getActivitiesAndEvaluation = async (req, res) => {
  try {
    const modules = [
      {
        id: 'survey',
        title: '1. Socio-Economic & Village Resource Survey',
        pillar: 'Field Immersion & Assessment',
        description: 'Students survey households and village infrastructure (drinking water, electricity, sanitation, primary health center, school, agriculture).',
        learning_outcome: 'Understand rural demographic realities, resource gaps, and community dynamics.',
        deliverables: ['Completed Household Questionnaire (min 10 households/group)', 'Village Infrastructure Matrix Report'],
        max_marks: 25,
        criteria: [
          { name: 'Survey Depth & Data Accuracy', max_marks: 10, rubric: 'Thoroughness of field survey and factual accuracy.' },
          { name: 'Community Interaction & Rapport', max_marks: 8, rubric: 'Respectful engagement with villagers and Sarpanch.' },
          { name: 'Data Organization & Documentation', max_marks: 7, rubric: 'Neatness and completeness of collected field logs.' }
        ]
      },
      {
        id: 'outreach',
        title: '2. Community Outreach & Social Engagement',
        pillar: 'Community Development',
        description: 'Conduct awareness drives, hygiene/sanitation sessions, primary school interactive sessions, and shramdaan.',
        learning_outcome: 'Develop empathy, civic responsibility, and active citizen participation.',
        deliverables: ['School Interaction Log & Photos', 'Community Activity Execution Report'],
        max_marks: 25,
        criteria: [
          { name: 'Impact & Relevance of Activity', max_marks: 10, rubric: 'Demonstrated value to village children/community.' },
          { name: 'Student Participation & Teamwork', max_marks: 10, rubric: 'Equal involvement of all panel group members.' },
          { name: 'Discipline & Cultural Sensitivity', max_marks: 5, rubric: 'Strict adherence to college codes and village ethos.' }
        ]
      },
      {
        id: 'innovation',
        title: '3. Grassroots Problem Identification & Innovation Proposal',
        pillar: 'Rural Innovation & Engineering Solutions',
        description: 'Identify one core technological, agricultural, or environmental challenge in the village and draft a practical solution.',
        learning_outcome: 'Apply academic knowledge to solve real-world rural challenges.',
        deliverables: ['Problem Identification Sheet', 'Proposed Sustainable Solution / Prototype Concept Document'],
        max_marks: 25,
        criteria: [
          { name: 'Problem Definition & Root Cause Analysis', max_marks: 10, rubric: 'Clarity of the identified challenge with ground evidence.' },
          { name: 'Feasibility & Sustainability of Solution', max_marks: 10, rubric: 'Practicality, cost-effectiveness, and community adoptability.' },
          { name: 'Innovation & Technical Application', max_marks: 5, rubric: 'Creative use of technology/engineering/management.' }
        ]
      },
      {
        id: 'presentation',
        title: '4. Village Debrief & Final Panel Presentation',
        pillar: 'Evaluation & Presentation',
        description: 'Panel-level group presentation summarizing 5-day immersion findings, learnings, and actionable recommendations.',
        learning_outcome: 'Synthesize immersion learnings and communicate actionable insights.',
        deliverables: ['Final Comprehensive Immersion Dossier', 'Panel Viva / Group Presentation'],
        max_marks: 25,
        criteria: [
          { name: 'Dossier Quality & Reflection', max_marks: 10, rubric: 'Depth of analysis, structured documentation, and reflections.' },
          { name: 'Presentation & Q&A Defense', max_marks: 10, rubric: 'Articulate presentation and confident handling of viva questions.' },
          { name: 'Peer Contribution & Mentor Evaluation', max_marks: 5, rubric: 'Overall mentor observation across the immersion period.' }
        ]
      }
    ];

    res.json({
      total_marks: 100,
      evaluation_modules: modules
    });
  } catch (err) {
    console.error('Error fetching activities and evaluation:', err);
    res.status(500).json({ message: 'Failed to load evaluation modules', error: err.message });
  }
};

// ─── 6. Get Rural Immersion Schedule Timeline ────────────────────────────────
const getImmersionSchedule = async (req, res) => {
  try {
    const schedule = [
      {
        day: 'Day 1',
        title: 'Departure & Village Entry',
        date_label: 'Day 1 — 06:00 AM to 08:00 PM',
        activities: [
          { time: '06:00 AM – 07:00 AM', title: 'Assembly & Flag-off at Campus', location: 'University Main Gate' },
          { time: '07:00 AM – 12:30 PM', title: 'Transit to Assigned Rural District / Village', location: 'Designated Bus' },
          { time: '01:00 PM – 02:30 PM', title: 'Arrival, Lodging Check-in & Panel Briefing', location: 'Village Base Camp' },
          { time: '03:30 PM – 05:30 PM', title: 'Formal Meeting with Sarpanch, Gram Sevak & Panchayat', location: 'Gram Panchayat Office' },
          { time: '06:30 PM – 08:00 PM', title: 'Evening Mentor Debrief & Day 2 Survey Planning', location: 'Camp Meeting Hall' }
        ]
      },
      {
        day: 'Day 2',
        title: 'Socio-Economic & Village Infrastructure Survey',
        date_label: 'Day 2 — 07:00 AM to 08:30 PM',
        activities: [
          { time: '07:00 AM – 08:00 AM', title: 'Morning Fitness & Day Briefing', location: 'Village Ground' },
          { time: '09:00 AM – 01:00 PM', title: 'Household Socio-Economic & Demographic Survey', location: 'Village Wards (Prabhags)' },
          { time: '02:00 PM – 04:30 PM', title: 'Infrastructure & Resource Mapping (Water, Power, Roads)', location: 'Village Landmarks' },
          { time: '05:00 PM – 06:30 PM', title: 'Data Consolidation with Panel Mentors', location: 'Base Camp' },
          { time: '07:00 PM – 08:30 PM', title: 'Cultural Interaction with Village Elders', location: 'Village Chawadi / Temple' }
        ]
      },
      {
        day: 'Day 3',
        title: 'Deep Briefing, NGO Visits & Concluding Immersion',
        date_label: 'Day 3 — 09:00 AM to 02:30 PM',
        activities: [
          { time: '09:00 AM – 10:30 AM', title: 'Deep Briefing & Immersion Reflection Session', location: 'Village Community Hall / Base Camp' },
          { time: '10:30 AM – 12:00 PM', title: 'Visit to NGOs & Grassroots Organizations', location: 'Local NGO Centers & Village Social Units' },
          { time: '12:00 PM – 02:30 PM', title: 'Journey to Life transformation center', location: 'Village Base Camp → Life Transformation Centre' }
        ]
      },
      {
        day: 'Day 4',
        title: 'Grassroot Innovation & Project Formulation',
        date_label: 'Day 4 — 08:00 AM to 08:30 PM',
        activities: [
          { time: '08:30 AM – 12:30 PM', title: 'Field Validation of Identified Rural Problem', location: 'Agricultural Fields / Water Sources' },
          { time: '02:00 PM – 05:00 PM', title: 'Team Solution Drafting & Poster Preparation', location: 'Base Camp' },
          { time: '05:30 PM – 07:30 PM', title: 'Mock Presentation & Mentor Feedback Session', location: 'Base Camp' }
        ]
      },
      {
        day: 'Day 5',
        title: 'Gram Sabha Presentation, Farewell & Return',
        date_label: 'Day 5 — 08:00 AM to 07:00 PM',
        activities: [
          { time: '09:00 AM – 11:30 AM', title: 'Gram Sabha Presentation & Submission to Sarpanch', location: 'Gram Panchayat Hall' },
          { time: '11:30 AM – 12:30 PM', title: 'Felicitation & Formal Farewell', location: 'Village School Ground' },
          { time: '01:30 PM – 06:30 PM', title: 'Return Transit to Campus', location: 'Designated Bus' },
          { time: '07:00 PM', title: 'Arrival at Campus & Final Attendance Sign-off', location: 'University Main Gate' }
        ]
      }
    ];

    res.json({ schedule });
  } catch (err) {
    console.error('Error fetching immersion schedule:', err);
    res.status(500).json({ message: 'Failed to load immersion schedule', error: err.message });
  }
};

// ─── 7. Get Panel Attendance Sheet (Activity-wise) ───────────────────────────
const getPanelAttendance = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const requestedActivity = req.query.activity ? String(req.query.activity).trim().toUpperCase() : null;
    const search = (req.query.search || '').trim();

    // Fetch Panel & Village metadata
    const panelRes = await pool.query(`
      SELECT 
        rp.id as panel_id,
        rp.panel_number,
        rp.name as panel_name,
        rb.name as batch_name,
        rb.status as batch_status,
        rb.start_date as batch_start_date,
        rb.end_date as batch_end_date,
        v.name as village_name,
        v.location as village_location
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);

    if (panelRes.rowCount === 0) {
      return res.status(404).json({ message: 'Panel not found in the selected batch.' });
    }

    const panelInfo = panelRes.rows[0];

    // Total enrolled students in this panel
    const totalStudentsRes = await pool.query(`
      SELECT COUNT(*)::int as count FROM ri_batch_students WHERE ri_batch_id = $1 AND ri_panel_id = $2
    `, [batchId, panelId]);
    const totalEnrolled = totalStudentsRes.rows[0]?.count || 0;

    // Fetch locks for all activities in this panel
    const locksRes = await pool.query(`
      SELECT al.activity, al.is_locked, al.locked_at, al.locked_by_email, al.unlocked_until, al.unlocked_at, al.unlocked_by_email, al.lock_reason, u.name as locked_by_name
      FROM ri_attendance_locks al
      LEFT JOIN users u ON al.locked_by_id = u.id
      WHERE al.ri_batch_id = $1 AND al.ri_panel_id = $2
    `, [batchId, panelId]);

    const locksMap = {};
    locksRes.rows.forEach(l => {
      locksMap[l.activity] = l;
    });

    // Fetch attendance summary for all 4 activities
    const attCountsRes = await pool.query(`
      SELECT 
        ra.activity,
        COUNT(CASE WHEN ra.status = 'Present' THEN 1 END)::int as present_count,
        COUNT(CASE WHEN ra.status = 'Absent' THEN 1 END)::int as absent_count
      FROM ri_attendance ra
      JOIN ri_batch_students rbs ON ra.student_id = rbs.student_id AND ra.ri_batch_id = rbs.ri_batch_id AND ra.ri_panel_id = rbs.ri_panel_id
      WHERE ra.ri_batch_id = $1 AND ra.ri_panel_id = $2
      GROUP BY ra.activity
    `, [batchId, panelId]);

    const countsMap = {};
    attCountsRes.rows.forEach(r => {
      countsMap[r.activity] = {
        present_count: r.present_count || 0,
        absent_count: r.absent_count || 0
      };
    });

    const deadlines = calculateRiVisitDeadlines(panelInfo.batch_start_date, panelInfo.batch_end_date);

    const activitiesSummary = RI_ACTIVITIES.map(act => {
      const counts = countsMap[act.key] || { present_count: 0, absent_count: 0 };
      const present = counts.present_count;
      const absent = counts.absent_count;
      const marked = present + absent;
      const unmarked = Math.max(0, totalEnrolled - marked);
      const pct = totalEnrolled > 0 ? Math.round((present / totalEnrolled) * 100) : 0;
      const lockObj = locksMap[act.key];
      const effective = computeEffectiveAttendanceLock({
        batchStartDate: panelInfo.batch_start_date,
        batchEndDate: panelInfo.batch_end_date,
        lockRow: lockObj
      });

      return {
        key: act.key,
        label: act.label,
        shortLabel: act.shortLabel,
        description: act.description,
        total_students: totalEnrolled,
        present_count: present,
        absent_count: absent,
        unmarked_count: unmarked,
        attendance_percentage: pct,
        is_locked: effective.is_locked,
        effective_status: effective.effective_status,
        is_auto_locked: effective.is_auto_locked,
        is_temp_unlocked: effective.is_temp_unlocked,
        temp_unlock_expired: effective.temp_unlock_expired || false,
        unlocked_until: effective.unlocked_until,
        lock_reason: effective.lock_reason,
        locked_at: effective.locked_at,
        locked_by_name: effective.locked_by_name,
        locked_by_email: effective.locked_by_email,
        unlocked_at: effective.unlocked_at,
        unlocked_by_email: effective.unlocked_by_email
      };
    });

    // If an activity is selected, fetch students roster for that activity
    let students = [];
    let selectedSummary = null;
    let selectedEffective = {
      is_locked: false,
      effective_status: 'UNLOCKED',
      is_auto_locked: false,
      is_temp_unlocked: false,
      temp_unlock_expired: false,
      unlocked_until: null,
      lock_reason: null,
      locked_at: null,
      locked_by_name: null,
      locked_by_email: null,
      unlocked_at: null,
      unlocked_by_email: null
    };

    if (requestedActivity && RI_ACTIVITY_KEYS.includes(requestedActivity)) {
      let query = `
        SELECT 
          u.id as student_id,
          COALESCE(u.name, 'Student') as student_name,
          u.prn,
          COALESCE(u.roll_number, rbs.ri_id) as roll_number,
          rbs.ri_id,
          u.department,
          u.division,
          u.gender,
          u.phone,
          COALESCE(ra.status, 'Unmarked') as attendance_status,
          ra.updated_at as marked_at,
          ra.marked_by_email,
          u2.name as marked_by_name,
          ra.remarks
        FROM ri_batch_students rbs
        JOIN users u ON rbs.student_id = u.id
        LEFT JOIN ri_attendance ra ON ra.student_id = u.id 
          AND ra.ri_batch_id = $1 
          AND ra.ri_panel_id = $2 
          AND ra.activity = $3
        LEFT JOIN users u2 ON ra.marked_by_email = u2.email
        WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      `;

      const params = [batchId, panelId, requestedActivity];

      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.prn) LIKE $${params.length} OR LOWER(rbs.ri_id) LIKE $${params.length})`;
      }

      query += ` ORDER BY u.roll_number ASC, u.name ASC`;

      const studentsRes = await pool.query(query, params);
      students = studentsRes.rows;

      const actSummary = activitiesSummary.find(a => a.key === requestedActivity);
      selectedSummary = actSummary ? {
        total_students: actSummary.total_students,
        present_count: actSummary.present_count,
        absent_count: actSummary.absent_count,
        unmarked_count: actSummary.unmarked_count,
        attendance_percentage: actSummary.attendance_percentage
      } : {
        total_students: totalEnrolled,
        present_count: 0,
        absent_count: 0,
        unmarked_count: totalEnrolled,
        attendance_percentage: 0
      };

      selectedEffective = computeEffectiveAttendanceLock({
        batchStartDate: panelInfo.batch_start_date,
        batchEndDate: panelInfo.batch_end_date,
        lockRow: locksMap[requestedActivity]
      });
    }

    res.json({
      panel: panelInfo,
      activities: activitiesSummary,
      selected_activity: requestedActivity,
      selected_activity_label: requestedActivity ? RI_ACTIVITY_LABEL_MAP[requestedActivity] : null,
      is_locked: selectedEffective.is_locked,
      effective_status: selectedEffective.effective_status,
      is_auto_locked: selectedEffective.is_auto_locked,
      is_temp_unlocked: selectedEffective.is_temp_unlocked,
      temp_unlock_expired: selectedEffective.temp_unlock_expired || false,
      unlocked_until: selectedEffective.unlocked_until,
      lock_reason: selectedEffective.lock_reason,
      locked_at: selectedEffective.locked_at,
      locked_by_email: selectedEffective.locked_by_email,
      locked_by_name: selectedEffective.locked_by_name,
      unlocked_at: selectedEffective.unlocked_at,
      unlocked_by_email: selectedEffective.unlocked_by_email,
      summary: selectedSummary,
      deadlines,
      students
    });
  } catch (err) {
    console.error('Error fetching panel attendance:', err);
    res.status(500).json({ message: 'Failed to fetch panel attendance', error: err.message });
  }
};

// ─── 8. Mark / Update Panel Attendance ───────────────────────────────────────
const markPanelAttendance = async (req, res) => {
  const client = await pool.connect();
  try {
    const scope = resolveFacultyScope(req, res, req.body.batch_id || req.body.ri_batch_id, req.body.panel_id || req.body.ri_panel_id);
    if (!scope.isValid) {
      client.release();
      return;
    }

    const { batchId, panelId } = scope;
    const rawActivity = req.body.activity || req.body.activity_key;
    const requestedActivity = String(rawActivity || 'SCHOOL_ACTIVITY').trim().toUpperCase();

    if (!RI_ACTIVITY_KEYS.includes(requestedActivity)) {
      client.release();
      return res.status(400).json({ message: `Invalid activity key '${rawActivity}'. Must be one of: ${RI_ACTIVITY_KEYS.join(', ')}` });
    }

    const activityLabel = RI_ACTIVITY_LABEL_MAP[requestedActivity] || requestedActivity;
    const markedByEmail = req.userEmail;
    const isLockRequested = req.body.action === 'save_and_lock' || req.body.lock === true || req.body.is_locked === true;
    const isUnlockRequested = req.body.action === 'unlock' || req.body.unlock === true;
    const isSuperAdminOrAdmin = ['superadmin', 'superadmin-ri', 'ri_admin', 'admin'].includes(req.user?.role);

    // 0. Backend Lock Enforcement: Verify authoritative effective lock state
    const batchDateRes = await client.query(`SELECT start_date, end_date FROM ri_batches WHERE id = $1`, [batchId]);
    const batchRow = batchDateRes.rows[0];

    const existingLockRes = await client.query(`
      SELECT al.is_locked, al.locked_at, al.locked_by_email, al.unlocked_until, al.unlocked_at, al.unlocked_by_email, al.lock_reason, u.name as locked_by_name
      FROM ri_attendance_locks al
      LEFT JOIN users u ON al.locked_by_id = u.id
      WHERE al.ri_batch_id = $1 AND al.ri_panel_id = $2 AND al.activity = $3
      LIMIT 1
    `, [batchId, panelId, requestedActivity]);

    const effective = computeEffectiveAttendanceLock({
      batchStartDate: batchRow?.start_date,
      batchEndDate: batchRow?.end_date,
      lockRow: existingLockRes.rows[0]
    });

    // Reject faculty attempts to edit locked attendance unless temporary unlock is active
    if (effective.is_locked && !isSuperAdminOrAdmin) {
      client.release();
      return res.status(403).json({
        success: false,
        message: `Attendance for ${activityLabel} is locked. ${effective.lock_reason || ''} Please contact Super Admin if unlocking is needed.`,
        is_locked: true,
        effective_status: effective.effective_status,
        is_auto_locked: effective.is_auto_locked,
        lock_reason: effective.lock_reason,
        unlocked_until: effective.unlocked_until,
        deadlines: effective.deadlines
      });
    }

    // Accept either a batch of records or a single student record
    let records = [];
    if (Array.isArray(req.body.records)) {
      records = req.body.records;
    } else if (Array.isArray(req.body.attendance)) {
      records = req.body.attendance;
    } else if (req.body.student_id) {
      records = [{
        student_id: req.body.student_id,
        status: req.body.status || 'Present',
        remarks: req.body.remarks || null
      }];
    }

    if (records.length === 0 && !isLockRequested && !isUnlockRequested) {
      client.release();
      return res.status(400).json({ message: 'No attendance records provided to save.' });
    }

    await client.query('BEGIN');

    // Validate that all student IDs belong to this panel in ri_batch_students
    const validStudentIdsRes = await client.query(`
      SELECT student_id FROM ri_batch_students WHERE ri_batch_id = $1 AND ri_panel_id = $2
    `, [batchId, panelId]);
    const validStudentSet = new Set(validStudentIdsRes.rows.map(r => r.student_id));

    let updatedCount = 0;
    for (const rec of records) {
      const studentId = parseInt(rec.student_id || rec.id, 10);
      if (!validStudentSet.has(studentId)) {
        continue; // Skip any unauthorized student ID to prevent panel tampering
      }

      let rawStatus = rec.status;
      let status = 'Present';
      if (rawStatus === 'P' || rawStatus === 'Present') status = 'Present';
      else if (rawStatus === 'A' || rawStatus === 'Absent') status = 'Absent';
      else if (rawStatus === 'Excused') status = 'Excused';
      else if (rawStatus === 'Approved') status = 'Approved';
      else if (rawStatus === 'Unmarked') status = 'Unmarked';
      const remarks = rec.remarks || null;
      const attDate = req.body.date || rec.date || new Date().toISOString().split('T')[0];
      const markedById = req.user?.id || null;

      if (status === 'Unmarked') {
        await client.query(`
          DELETE FROM ri_attendance 
          WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND student_id = $3 AND activity = $4
        `, [batchId, panelId, studentId, requestedActivity]);
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
        `, [batchId, panelId, studentId, requestedActivity, attDate, status, markedByEmail, markedById, isLockRequested, remarks]);
      }
      updatedCount++;
    }

    // Update Attendance Lock Table
    let finalLockState = effective.is_locked;
    if (isLockRequested) {
      finalLockState = true;
      await client.query(`
        INSERT INTO ri_attendance_locks (
          ri_batch_id, ri_panel_id, activity, is_locked, locked_at, locked_by_email, locked_by_id, unlocked_until, lock_reason, updated_at
        )
        VALUES ($1, $2, $3, true, NOW(), $4, $5, NULL, 'Locked by Faculty on completion', NOW())
        ON CONFLICT (ri_batch_id, ri_panel_id, activity)
        DO UPDATE SET
          is_locked = true,
          locked_at = NOW(),
          locked_by_email = EXCLUDED.locked_by_email,
          locked_by_id = EXCLUDED.locked_by_id,
          unlocked_until = NULL,
          lock_reason = 'Locked by Faculty on completion',
          updated_at = NOW()
      `, [batchId, panelId, requestedActivity, markedByEmail, req.user?.id || null]);
    } else if (isUnlockRequested && isSuperAdminOrAdmin) {
      finalLockState = false;
      await client.query(`
        INSERT INTO ri_attendance_locks (
          ri_batch_id, ri_panel_id, activity, is_locked, locked_at, locked_by_email, locked_by_id, unlocked_until, unlocked_at, unlocked_by_email, lock_reason, updated_at
        )
        VALUES ($1, $2, $3, false, NULL, NULL, NULL, NULL, NOW(), $4, 'Unlocked by Administrator', NOW())
        ON CONFLICT (ri_batch_id, ri_panel_id, activity)
        DO UPDATE SET
          is_locked = false,
          locked_at = NULL,
          locked_by_email = NULL,
          locked_by_id = NULL,
          unlocked_until = NULL,
          unlocked_at = NOW(),
          unlocked_by_email = EXCLUDED.unlocked_by_email,
          lock_reason = 'Unlocked by Administrator',
          updated_at = NOW()
      `, [batchId, panelId, requestedActivity, markedByEmail]);
    }

    await client.query('COMMIT');
    client.release();

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: req.user?.id,
      userEmail: markedByEmail,
      userName: req.user?.name,
      userRole: req.user?.role || 'faculty',
      action: isLockRequested ? 'SAVE_AND_LOCK_PANEL_ATTENDANCE' : (isUnlockRequested ? 'UNLOCK_PANEL_ATTENDANCE' : 'MARK_PANEL_ATTENDANCE'),
      batchId,
      panelId,
      details: { activity: requestedActivity, records_updated: updatedCount, is_locked: finalLockState }
    });

    res.json({
      success: true,
      message: isLockRequested
        ? `Successfully saved and locked ${activityLabel} attendance for ${updatedCount} student(s).`
        : (isUnlockRequested
            ? `Successfully unlocked ${activityLabel} attendance.`
            : `Successfully saved ${activityLabel} attendance for ${updatedCount} student(s).`),
      activity: requestedActivity,
      updated_count: updatedCount,
      is_locked: finalLockState
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    console.error('Error marking panel attendance:', err);
    res.status(500).json({ message: 'Failed to update attendance', error: err.message });
  }
};

// ─── 8.5 Mark All Activities Present ─────────────────────────────────────────
const markAllActivitiesPresent = async (req, res) => {
  const client = await pool.connect();
  try {
    const scope = resolveFacultyScope(req, res, req.body.batch_id || req.body.ri_batch_id, req.body.panel_id || req.body.ri_panel_id);
    if (!scope.isValid) {
      client.release();
      return;
    }

    const { batchId, panelId } = scope;
    const overwriteAbsent = req.body.overwrite_absent === true;
    const markedByEmail = req.userEmail;
    const markedById = req.user?.id || null;
    const isSuperAdminOrAdmin = ['superadmin', 'superadmin-ri', 'ri_admin', 'admin'].includes(req.user?.role);

    // 0. Effective Lock Enforcement for each activity
    const batchDateRes = await client.query(`SELECT start_date, end_date FROM ri_batches WHERE id = $1`, [batchId]);
    const batchRow = batchDateRes.rows[0];

    const locksRes = await client.query(`
      SELECT al.activity, al.is_locked, al.locked_at, al.locked_by_email, al.unlocked_until, al.unlocked_at, al.unlocked_by_email, al.lock_reason
      FROM ri_attendance_locks al
      WHERE al.ri_batch_id = $1 AND al.ri_panel_id = $2
    `, [batchId, panelId]);

    const locksMap = {};
    locksRes.rows.forEach(r => { locksMap[r.activity] = r; });

    const unlockedActivities = RI_ACTIVITY_KEYS.filter(actKey => {
      if (isSuperAdminOrAdmin) return true;
      const eff = computeEffectiveAttendanceLock({
        batchStartDate: batchRow?.start_date,
        batchEndDate: batchRow?.end_date,
        lockRow: locksMap[actKey]
      });
      return !eff.is_locked;
    });

    const lockedActivities = new Set(
      RI_ACTIVITY_KEYS.filter(actKey => !unlockedActivities.includes(actKey))
    );

    if (unlockedActivities.length === 0) {
      client.release();
      return res.status(403).json({
        success: false,
        message: 'Attendance is locked for all activities in this panel. Please contact Super Admin if temporary unlock is needed.',
        is_locked: true
      });
    }

    // 2. Check for existing ABSENT records in unlocked activities
    const absentRes = await client.query(`
      SELECT COUNT(*)::int as count 
      FROM ri_attendance ra
      JOIN ri_batch_students rbs ON ra.student_id = rbs.student_id AND ra.ri_batch_id = rbs.ri_batch_id AND ra.ri_panel_id = rbs.ri_panel_id
      WHERE ra.ri_batch_id = $1 AND ra.ri_panel_id = $2 AND ra.activity = ANY($3::varchar[]) AND ra.status = 'Absent'
    `, [batchId, panelId, unlockedActivities]);

    const absentCount = absentRes.rows[0]?.count || 0;

    if (!overwriteAbsent && absentCount > 0) {
      client.release();
      return res.json({
        success: false,
        require_confirmation: true,
        absent_count: absentCount,
        unlocked_activities_count: unlockedActivities.length,
        locked_activities_count: lockedActivities.size,
        message: `Found ${absentCount} existing ABSENT record(s) across ${unlockedActivities.length} unlocked activity/activities. Overwriting will change them to PRESENT.`
      });
    }

    // 3. Fetch all enrolled students
    const studentsRes = await client.query(`
      SELECT student_id FROM ri_batch_students WHERE ri_batch_id = $1 AND ri_panel_id = $2
    `, [batchId, panelId]);
    const students = studentsRes.rows;

    if (students.length === 0) {
      client.release();
      return res.status(400).json({ success: false, message: 'No students enrolled in this panel.' });
    }

    await client.query('BEGIN');
    const todayStr = new Date().toISOString().split('T')[0];
    let totalUpdated = 0;

    for (const act of unlockedActivities) {
      for (const st of students) {
        await client.query(`
          INSERT INTO ri_attendance (
            ri_batch_id, ri_panel_id, student_id, activity, date,
            status, marked_by_email, marked_by_id, is_locked, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, 'Present', $6, $7, false, NOW())
          ON CONFLICT (ri_batch_id, ri_panel_id, student_id, activity)
          DO UPDATE SET 
            status = 'Present',
            date = EXCLUDED.date,
            marked_by_email = EXCLUDED.marked_by_email,
            marked_by_id = EXCLUDED.marked_by_id,
            updated_at = NOW()
        `, [batchId, panelId, st.student_id, act, todayStr, markedByEmail, markedById]);
        totalUpdated++;
      }
    }

    await client.query('COMMIT');
    client.release();

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: req.user?.id,
      userEmail: markedByEmail,
      userName: req.user?.name,
      userRole: req.user?.role || 'faculty',
      action: 'MARK_ALL_ACTIVITIES_PRESENT',
      batchId,
      panelId,
      details: { unlocked_activities: unlockedActivities, records_updated: totalUpdated }
    });

    const lockedMsg = lockedActivities.size > 0 ? ` (${lockedActivities.size} locked activity/activities were preserved)` : '';
    res.json({
      success: true,
      message: `Successfully marked ${students.length} student(s) PRESENT for all ${unlockedActivities.length} unlocked activity/activities${lockedMsg}.`,
      updated_count: totalUpdated,
      unlocked_count: unlockedActivities.length,
      locked_count: lockedActivities.size
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    console.error('Error marking all activities present:', err);
    res.status(500).json({ message: 'Failed to mark all activities present', error: err.message });
  }
};

// ─── 9. Get Panel Student Submissions Table ──────────────────────────────────
const getPanelSubmissions = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { form_type, status, search } = req.query;

    let query = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number, '') as ri_id,
        u.department,
        u.division,
        rp.panel_number,
        rp.name as panel_name,
        v.name as village_name,
        
        -- Form sub-queries & timestamps
        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'UNDERTAKING' LIMIT 1),
          CASE WHEN EXISTS (SELECT 1 FROM ri_undertakings ru WHERE ru.student_id = u.id AND ru.status = 'Submitted') OR u.undertaking_submitted = true THEN 'Submitted'
               WHEN EXISTS (SELECT 1 FROM ri_undertakings ru WHERE ru.student_id = u.id) THEN 'Draft'
               ELSE 'Not Started' END
        ) as undertaking_status,
        COALESCE(
          (SELECT submission_timestamp FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'UNDERTAKING' LIMIT 1),
          (SELECT created_at FROM ri_undertakings ru WHERE ru.student_id = u.id AND ru.status = 'Submitted' LIMIT 1)
        ) as undertaking_time,

        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type IN ('DAILY_ACTIVITY', 'DAILY_ACTIVITY_REPORT', 'FORM_IIIB') ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_daily_activity_reports dar WHERE dar.student_id = u.id AND dar.ri_batch_id = $1 ORDER BY dar.id DESC LIMIT 1),
          'Not Started'
        ) as daily_activity_status,
        COALESCE(
          (SELECT submission_timestamp FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type IN ('DAILY_ACTIVITY', 'DAILY_ACTIVITY_REPORT', 'FORM_IIIB') ORDER BY sf.id DESC LIMIT 1),
          (SELECT created_at FROM ri_daily_activity_reports dar WHERE dar.student_id = u.id AND dar.ri_batch_id = $1 AND dar.status = 'Submitted' ORDER BY dar.id DESC LIMIT 1)
        ) as daily_activity_time,

        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'INSTITUTIONAL_VISIT' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_institutional_visits iv WHERE iv.student_id = u.id AND iv.ri_batch_id = $1 ORDER BY (CASE WHEN iv.status = 'Submitted' THEN 1 ELSE 2 END), iv.id DESC LIMIT 1),
          'Not Started'
        ) as institutional_status,
        COALESCE(
          (SELECT submission_timestamp FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'INSTITUTIONAL_VISIT' ORDER BY sf.id DESC LIMIT 1),
          (SELECT created_at FROM ri_institutional_visits iv WHERE iv.student_id = u.id AND iv.ri_batch_id = $1 AND iv.status = 'Submitted' ORDER BY iv.id DESC LIMIT 1)
        ) as institutional_time,

        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'FAMILY_SURVEY' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_family_surveys fs WHERE fs.student_id = u.id AND fs.ri_batch_id = $1 ORDER BY (CASE WHEN fs.status = 'Submitted' THEN 1 ELSE 2 END), fs.id DESC LIMIT 1),
          'Not Started'
        ) as family_status,
        COALESCE(
          (SELECT submission_timestamp FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'FAMILY_SURVEY' ORDER BY sf.id DESC LIMIT 1),
          (SELECT updated_at FROM ri_family_surveys fs WHERE fs.student_id = u.id AND fs.ri_batch_id = $1 AND fs.status = 'Submitted' ORDER BY fs.id DESC LIMIT 1)
        ) as family_time,

        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'PROBLEM_IDENTIFICATION' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_problem_identifications pi WHERE pi.student_id = u.id AND pi.ri_batch_id = $1 ORDER BY pi.id DESC LIMIT 1),
          'Not Started'
        ) as problem_status,
        (SELECT submission_timestamp FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'PROBLEM_IDENTIFICATION' ORDER BY sf.id DESC LIMIT 1) as problem_time,

        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'STUDENT_FEEDBACK' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_student_feedbacks fb WHERE fb.student_id = u.id AND fb.ri_batch_id = $1 ORDER BY fb.id DESC LIMIT 1),
          'Not Started'
        ) as feedback_status,
        (SELECT submission_timestamp FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'STUDENT_FEEDBACK' ORDER BY sf.id DESC LIMIT 1) as feedback_time,

        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'PREPARATORY_CHECKLIST' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_preparatory_checklists pc WHERE pc.student_id = u.id AND pc.ri_batch_id = $1 ORDER BY pc.id DESC LIMIT 1),
          'Not Started'
        ) as checklist_status,
        (SELECT submission_timestamp FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'PREPARATORY_CHECKLIST' ORDER BY sf.id DESC LIMIT 1) as checklist_time,

        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'COMMUNITY_PROJECT' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_community_projects cp WHERE cp.student_id = u.id AND cp.ri_batch_id = $1 ORDER BY cp.id DESC LIMIT 1),
          'Not Started'
        ) as community_project_status,
        COALESCE(
          (SELECT submission_timestamp FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'COMMUNITY_PROJECT' ORDER BY sf.id DESC LIMIT 1),
          (SELECT created_at FROM ri_community_projects cp WHERE cp.student_id = u.id AND cp.ri_batch_id = $1 AND cp.status = 'Submitted' ORDER BY cp.id DESC LIMIT 1)
        ) as community_project_time,

        -- Evaluation status & marks
        e.evaluation_status,
        e.total_marks,
        e.overall_grade,
        e.submitted_at as evaluated_at

      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_evaluations e ON e.student_id = u.id AND e.ri_batch_id = $1
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
    `;

    const params = [batchId, panelId];

    if (search && search.trim()) {
      params.push(`%${search.toLowerCase().trim()}%`);
      query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.prn) LIKE $${params.length} OR LOWER(rbs.ri_id) LIKE $${params.length})`;
    }

    query += ` ORDER BY u.roll_number ASC, u.name ASC`;

    const result = await pool.query(query, params);

    const FORM_DEFS = [
      { key: 'UNDERTAKING', code: 'Annex E', title: 'Student Undertaking (Annex E)', statusField: 'undertaking_status', timeField: 'undertaking_time' },
      { key: 'DAILY_ACTIVITY', code: 'Form III B', title: 'Daily Activity Report (Form III B)', statusField: 'daily_activity_status', timeField: 'daily_activity_time' },
      { key: 'INSTITUTIONAL_VISIT', code: 'Form IV', title: 'Institutional Visits (Form IV)', statusField: 'institutional_status', timeField: 'institutional_time' },
      { key: 'FAMILY_SURVEY', code: 'Form V', title: 'Family Visits (Form V)', statusField: 'family_status', timeField: 'family_time' },
      { key: 'PROBLEM_IDENTIFICATION', code: 'Form VI', title: 'Problem Identification & SMART Solution (Form VI)', statusField: 'problem_status', timeField: 'problem_time' },
      { key: 'COMMUNITY_PROJECT', code: 'Form VII', title: 'Community Project (Form VII)', statusField: 'community_project_status', timeField: 'community_project_time' },
      { key: 'STUDENT_FEEDBACK', code: 'Form VIII', title: 'RI Feedback Form (Form VIII)', statusField: 'feedback_status', timeField: 'feedback_time' },
      { key: 'PREPARATORY_CHECKLIST', code: 'Form I B', title: 'Preparatory Phase Checklist (Form I B)', statusField: 'checklist_status', timeField: 'checklist_time' }
    ];

    const targetFormDefs = (form_type && form_type !== 'ALL')
      ? FORM_DEFS.filter(f => f.key === form_type)
      : FORM_DEFS;

    let submissions = [];
    result.rows.forEach(s => {
      targetFormDefs.forEach(f => {
        const submissionStatus = s[f.statusField] || 'Not Started';
        const submissionTimestamp = s[f.timeField] || null;

        // Apply status filter if specified and not 'ALL'
        if (status && status !== 'ALL') {
          if (submissionStatus.toLowerCase() !== status.toLowerCase()) {
            return;
          }
        }

        submissions.push({
          submission_id: `${s.student_id}-${f.key}`,
          student_id: s.student_id,
          student_name: s.student_name,
          prn: s.prn,
          ri_id: s.ri_id,
          department: s.department,
          division: s.division,
          panel_number: s.panel_number,
          panel_name: s.panel_name,
          village_name: s.village_name,
          form_type: f.key,
          form_code: f.code,
          form_title: f.title,
          submission_status: submissionStatus,
          submission_timestamp: submissionTimestamp,
          evaluation_status: s.evaluation_status || 'Pending',
          total_marks: s.total_marks,
          overall_grade: s.overall_grade
        });
      });
    });

    // Sort: if form_type === 'ALL', put active submissions (Submitted, Reviewed, Requires Correction) first
    if (!form_type || form_type === 'ALL') {
      submissions.sort((a, b) => {
        const activeOrder = { 'Submitted': 1, 'Reviewed': 2, 'Requires Correction': 3, 'Draft': 4, 'Not Started': 5 };
        const orderA = activeOrder[a.submission_status] || 5;
        const orderB = activeOrder[b.submission_status] || 5;
        if (orderA !== orderB) return orderA - orderB;
        if (a.submission_timestamp && b.submission_timestamp) {
          return new Date(b.submission_timestamp) - new Date(a.submission_timestamp);
        }
        return a.student_name.localeCompare(b.student_name);
      });
    }

    res.json({
      success: true,
      batch_id: batchId,
      panel_id: panelId,
      total_students: result.rows.length,
      total_submissions: submissions.length,
      submissions
    });
  } catch (err) {
    console.error('Error fetching panel submissions:', err);
    res.status(500).json({ message: 'Failed to load panel submissions', error: err.message });
  }
};

// ─── 10. Get Student Complete RI Profile & Evaluation Workspace (10 Tabs) ────
const getStudentSubmissionDetail = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const studentId = parseInt(req.params.studentId, 10);

    if (!studentId) {
      return res.status(400).json({ message: 'Invalid Student ID provided.' });
    }

    // Verify student belongs to this panel in this batch
    const studentCheck = await pool.query(`
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        u.email as student_email,
        u.department,
        u.division,
        u.gender,
        u.phone,
        COALESCE(u.roll_number, rbs.ri_id) as roll_number,
        rbs.ri_id,
        rbs.enrolled_at,
        rb.id as batch_id,
        rb.name as batch_name,
        rb.status as batch_status,
        rb.start_date as batch_start_date,
        rb.end_date as batch_end_date,
        rp.id as panel_id,
        rp.panel_number,
        rp.name as panel_name,
        v.id as village_id,
        v.name as village_name,
        v.location as village_location,
        v.sarpanch_name,
        v.sarpanch_mobile
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rbs.student_id = $1 AND rbs.ri_batch_id = $2 AND rbs.ri_panel_id = $3
    `, [studentId, batchId, panelId]);

    if (studentCheck.rowCount === 0) {
      return res.status(404).json({ message: 'Student is not assigned to this panel and batch.' });
    }
    const studentInfo = studentCheck.rows[0];

    // Log faculty view action
    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: req.user?.id,
      userEmail: req.userEmail,
      userName: req.user?.name,
      userRole: 'faculty',
      action: 'VIEW_STUDENT_SUBMISSION',
      studentId,
      batchId,
      panelId,
      details: { student_name: studentInfo.student_name, prn: studentInfo.prn }
    });

    // 1. Attendance Records (4 Activities)
    const attRes = await pool.query(`
      SELECT a.activity, a.date, a.status, a.marked_by_email, u.name as marked_by_name, a.remarks, a.updated_at
      FROM ri_attendance a
      LEFT JOIN users u ON a.marked_by_email = u.email
      WHERE a.student_id = $1 AND a.ri_batch_id = $2 AND a.ri_panel_id = $3
      ORDER BY a.id ASC
    `, [studentId, batchId, panelId]);

    const attMap = {};
    attRes.rows.forEach(r => { attMap[r.activity] = r; });
    const attendanceData = {
      activities: RI_ACTIVITIES.map(act => ({
        key: act.key,
        label: act.label,
        ...(attMap[act.key] || { activity: act.key, status: 'Unmarked', date: null, remarks: '' })
      })),
      records: attRes.rows
    };

    // 2. Forms Summary Table
    const formsSummaryRes = await pool.query(`
      SELECT 
        form_type, status, progress_percent,
        submission_timestamp, last_updated_at,
        faculty_remarks, correction_notes, reviewed_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, batchId]);

    // 3. Undertaking Form Record
    let underRes = await pool.query(`
      SELECT * FROM ri_undertakings WHERE student_id = $1
    `, [studentId]);

    if (underRes.rowCount === 0) {
      const userUnder = await pool.query(`
        SELECT 
          id,
          undertaking_signed_name as signed_name,
          undertaking_signed_date as signed_date,
          emergency_contact_name,
          emergency_contact_relation,
          emergency_contact_mobile,
          emergency_contact_alt_mobile,
          emergency_contact_email,
          emergency_contact_mobile as parent_contact,
          emergency_contact_name as parent_name,
          blood_group,
          medical_conditions,
          known_allergies,
          current_medication,
          dietary_restrictions,
          medical_other,
          coalesce(consent_media, photo_video_consent, true) as consent_photo_video,
          coalesce(consent_medical, true) as consent_medical_emergency,
          coalesce(consent_data, true) as consent_field_work,
          coalesce(consent_checks, true) as consent_code_of_conduct,
          undertaking_submitted as is_accepted,
          'Submitted' as status,
          created_at
        FROM users 
        WHERE id = $1 AND (undertaking_submitted = true OR ri_undertaking_submitted = true)
      `, [studentId]);
      if (userUnder.rowCount > 0) {
        underRes = userUnder;
      }
    }

    // 4. Preparatory Checklist (Form IB)
    const prepRes = await pool.query(`
      SELECT * FROM ri_preparatory_checklists WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, batchId]);

    // 5. Institutional Visits (Form IV)
    const instRes = await pool.query(`
      SELECT * FROM ri_institutional_visits WHERE student_id = $1 AND ri_batch_id = $2 ORDER BY id ASC
    `, [studentId, batchId]);

    // 6. Family Survey (Form V)
    const famRes = await pool.query(`
      SELECT * FROM ri_family_surveys WHERE student_id = $1 AND ri_batch_id = $2 ORDER BY family_serial_number ASC
    `, [studentId, batchId]);

    // 7. Problem Identification & Solution (Form VI)
    const probRes = await pool.query(`
      SELECT * FROM ri_problem_identifications WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, batchId]);

    // 8. Daily Activity Report (Form IIIB)
    const dailyActRes = await pool.query(`
      SELECT * FROM ri_daily_activity_reports WHERE student_id = $1 AND ri_batch_id = $2 ORDER BY id DESC LIMIT 1
    `, [studentId, batchId]);

    // 8b. Community Project
    const projRes = await pool.query(`
      SELECT * FROM ri_community_projects WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, batchId]);

    // 9. Feedback Form
    const fbRes = await pool.query(`
      SELECT * FROM ri_student_feedbacks WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, batchId]);

    // Reconcile and guarantee 100% authoritative forms_summary for all 7 official forms
    const formsMap = {};
    formsSummaryRes.rows.forEach(r => {
      formsMap[r.form_type] = r;
    });

    // 1. UNDERTAKING
    let undertakingStatus = formsMap['UNDERTAKING']?.status;
    let undertakingTimestamp = formsMap['UNDERTAKING']?.submission_timestamp;
    if (!undertakingStatus) {
      if (underRes.rowCount > 0 && (underRes.rows[0].status === 'Submitted' || underRes.rows[0].is_accepted)) {
        undertakingStatus = 'Submitted';
        undertakingTimestamp = underRes.rows[0].created_at || underRes.rows[0].signed_date;
      } else if (underRes.rowCount > 0) {
        undertakingStatus = 'Draft';
      } else {
        undertakingStatus = 'Not Started';
      }
    }
    const isUndertakingSubmitted = undertakingStatus === 'Submitted' || undertakingStatus === 'Reviewed';

    // 2. DAILY_ACTIVITY_REPORT (includes Community Project)
    let dailyStatus = formsMap['DAILY_ACTIVITY_REPORT']?.status || formsMap['DAILY_ACTIVITY']?.status;
    let dailyTimestamp = formsMap['DAILY_ACTIVITY_REPORT']?.submission_timestamp || formsMap['DAILY_ACTIVITY']?.submission_timestamp;
    let dailyProgress = formsMap['DAILY_ACTIVITY_REPORT']?.progress_percent || formsMap['DAILY_ACTIVITY']?.progress_percent || 0;
    if (!dailyStatus) {
      if (dailyActRes.rows[0]?.status === 'Submitted' || projRes.rows[0]?.status === 'Submitted') {
        dailyStatus = 'Submitted';
        dailyTimestamp = dailyActRes.rows[0]?.created_at || projRes.rows[0]?.created_at;
      } else if (dailyActRes.rowCount > 0 || projRes.rowCount > 0) {
        dailyStatus = 'Draft';
        dailyProgress = 50;
      } else {
        dailyStatus = 'Not Started';
      }
    }
    const isDailySubmitted = dailyStatus === 'Submitted' || dailyStatus === 'Reviewed';

    // 3. INSTITUTIONAL_VISIT
    let instStatus = formsMap['INSTITUTIONAL_VISIT']?.status;
    let instTimestamp = formsMap['INSTITUTIONAL_VISIT']?.submission_timestamp;
    let instProgress = formsMap['INSTITUTIONAL_VISIT']?.progress_percent || 0;
    if (!instStatus) {
      const anyInstSubmitted = instRes.rows.some(r => r.status === 'Submitted');
      if (anyInstSubmitted) {
        instStatus = 'Submitted';
        instTimestamp = instRes.rows.find(r => r.status === 'Submitted')?.created_at;
      } else if (instRes.rowCount > 0) {
        instStatus = 'Draft';
        const validInst = instRes.rows.filter(r => r.institution_name?.trim()).length;
        instProgress = validInst >= 2 ? 85 : 45;
      } else {
        instStatus = 'Not Started';
      }
    }
    const isInstSubmitted = instStatus === 'Submitted' || instStatus === 'Reviewed';

    // 4. FAMILY_SURVEY
    let famStatus = formsMap['FAMILY_SURVEY']?.status;
    let famTimestamp = formsMap['FAMILY_SURVEY']?.submission_timestamp;
    let famProgress = formsMap['FAMILY_SURVEY']?.progress_percent || 0;
    if (!famStatus) {
      const anyFamSubmitted = famRes.rows.some(r => r.status === 'Submitted');
      if (anyFamSubmitted) {
        famStatus = 'Submitted';
        famTimestamp = famRes.rows.find(r => r.status === 'Submitted')?.updated_at || famRes.rows[0]?.created_at;
      } else if (famRes.rowCount > 0) {
        famStatus = 'Draft';
        famProgress = Math.min(90, Math.round((famRes.rowCount / 3) * 80));
      } else {
        famStatus = 'Not Started';
      }
    }
    const isFamSubmitted = famStatus === 'Submitted' || famStatus === 'Reviewed';

    // 5. PROBLEM_IDENTIFICATION
    let probStatus = formsMap['PROBLEM_IDENTIFICATION']?.status;
    let probTimestamp = formsMap['PROBLEM_IDENTIFICATION']?.submission_timestamp;
    let probProgress = formsMap['PROBLEM_IDENTIFICATION']?.progress_percent || 0;
    if (!probStatus) {
      if (probRes.rows[0]?.status === 'Submitted') {
        probStatus = 'Submitted';
        probTimestamp = probRes.rows[0]?.created_at;
      } else if (probRes.rowCount > 0) {
        probStatus = 'Draft';
        probProgress = 50;
      } else {
        probStatus = 'Not Started';
      }
    }
    const isProbSubmitted = probStatus === 'Submitted' || probStatus === 'Reviewed';

    // 6. STUDENT_FEEDBACK
    let fbStatus = formsMap['STUDENT_FEEDBACK']?.status;
    let fbTimestamp = formsMap['STUDENT_FEEDBACK']?.submission_timestamp;
    let fbProgress = formsMap['STUDENT_FEEDBACK']?.progress_percent || 0;
    if (!fbStatus) {
      if (fbRes.rows[0]?.status === 'Submitted') {
        fbStatus = 'Submitted';
        fbTimestamp = fbRes.rows[0]?.created_at;
      } else if (fbRes.rowCount > 0) {
        fbStatus = 'Draft';
        fbProgress = 50;
      } else {
        fbStatus = 'Not Started';
      }
    }
    const isFbSubmitted = fbStatus === 'Submitted' || fbStatus === 'Reviewed';

    // 7. PREPARATORY_CHECKLIST
    let checkStatus = formsMap['PREPARATORY_CHECKLIST']?.status;
    let checkTimestamp = formsMap['PREPARATORY_CHECKLIST']?.submission_timestamp;
    let checkProgress = formsMap['PREPARATORY_CHECKLIST']?.progress_percent || 0;
    if (!checkStatus) {
      if (prepRes.rows[0]?.status === 'Submitted') {
        checkStatus = 'Submitted';
        checkTimestamp = prepRes.rows[0]?.created_at;
      } else if (prepRes.rowCount > 0) {
        checkStatus = 'Draft';
        checkProgress = 60;
      } else {
        checkStatus = 'Not Started';
      }
    }
    // 8. COMMUNITY_PROJECT
    let commProjStatus = formsMap['COMMUNITY_PROJECT']?.status;
    let commProjTimestamp = formsMap['COMMUNITY_PROJECT']?.submission_timestamp;
    let commProjProgress = formsMap['COMMUNITY_PROJECT']?.progress_percent || 0;
    if (!commProjStatus) {
      if (projRes.rows[0]?.status === 'Submitted') {
        commProjStatus = 'Submitted';
        commProjTimestamp = projRes.rows[0]?.created_at;
      } else if (projRes.rowCount > 0) {
        commProjStatus = 'Draft';
        commProjProgress = 50;
      } else {
        commProjStatus = 'Not Started';
      }
    }
    const isCommProjSubmitted = commProjStatus === 'Submitted' || commProjStatus === 'Reviewed';
    const isCheckSubmitted = checkStatus === 'Submitted' || checkStatus === 'Reviewed';

    // Build unified reconciled forms_summary with guaranteed 100% on genuine submissions and accurate drafts
    const reconciledSummary = [
      {
        form_type: 'UNDERTAKING',
        status: undertakingStatus,
        progress_percent: isUndertakingSubmitted ? 100 : (undertakingStatus === 'Draft' ? 50 : 0),
        submission_timestamp: undertakingTimestamp || null,
        faculty_remarks: formsMap['UNDERTAKING']?.faculty_remarks || null
      },
      {
        form_type: 'DAILY_ACTIVITY_REPORT',
        status: dailyStatus,
        progress_percent: isDailySubmitted ? 100 : (dailyStatus === 'Draft' ? Math.min(95, Math.max(10, dailyProgress)) : 0),
        submission_timestamp: dailyTimestamp || null,
        faculty_remarks: formsMap['DAILY_ACTIVITY_REPORT']?.faculty_remarks || null
      },
      {
        form_type: 'INSTITUTIONAL_VISIT',
        status: instStatus,
        progress_percent: isInstSubmitted ? 100 : (instStatus === 'Draft' ? Math.min(95, Math.max(10, instProgress)) : 0),
        submission_timestamp: instTimestamp || null,
        faculty_remarks: formsMap['INSTITUTIONAL_VISIT']?.faculty_remarks || null
      },
      {
        form_type: 'FAMILY_SURVEY',
        status: famStatus,
        progress_percent: isFamSubmitted ? 100 : (famStatus === 'Draft' ? Math.min(95, Math.max(10, famProgress)) : 0),
        submission_timestamp: famTimestamp || null,
        faculty_remarks: formsMap['FAMILY_SURVEY']?.faculty_remarks || null
      },
      {
        form_type: 'PROBLEM_IDENTIFICATION',
        status: probStatus,
        progress_percent: isProbSubmitted ? 100 : (probStatus === 'Draft' ? Math.min(95, Math.max(10, probProgress)) : 0),
        submission_timestamp: probTimestamp || null,
        faculty_remarks: formsMap['PROBLEM_IDENTIFICATION']?.faculty_remarks || null
      },
      {
        form_type: 'COMMUNITY_PROJECT',
        status: commProjStatus,
        progress_percent: isCommProjSubmitted ? 100 : (commProjStatus === 'Draft' ? Math.min(95, Math.max(10, commProjProgress)) : 0),
        submission_timestamp: commProjTimestamp || null,
        faculty_remarks: formsMap['COMMUNITY_PROJECT']?.faculty_remarks || null
      },
      {
        form_type: 'STUDENT_FEEDBACK',
        status: fbStatus,
        progress_percent: isFbSubmitted ? 100 : (fbStatus === 'Draft' ? Math.min(95, Math.max(10, fbProgress)) : 0),
        submission_timestamp: fbTimestamp || null,
        faculty_remarks: formsMap['STUDENT_FEEDBACK']?.faculty_remarks || null
      },
      {
        form_type: 'PREPARATORY_CHECKLIST',
        status: checkStatus,
        progress_percent: isCheckSubmitted ? 100 : (checkStatus === 'Draft' ? Math.min(95, Math.max(10, checkProgress)) : 0),
        submission_timestamp: checkTimestamp || null,
        faculty_remarks: formsMap['PREPARATORY_CHECKLIST']?.faculty_remarks || null
      }
    ];

    // 10. Current Evaluation
    const evalRes = await pool.query(`
      SELECT 
        e.*,
        u.name as evaluator_name,
        u.email as evaluator_email
      FROM ri_evaluations e
      LEFT JOIN users u ON e.evaluator_faculty_id = u.id
      WHERE e.student_id = $1 AND e.ri_batch_id = $2
    `, [studentId, batchId]);

    // 11. Audit History for this student
    const auditRes = await pool.query(`
      SELECT id, action, user_name, user_role, user_email, details, created_at
      FROM ri_audit_logs
      WHERE student_id = $1 AND ri_batch_id = $2
      ORDER BY created_at DESC
      LIMIT 25
    `, [studentId, batchId]);

    // Assigned Mentors
    const mentorsRes = await pool.query(`
      SELECT name, email, role, department, designation FROM ri_batch_faculty
      WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND status <> 'deleted'
      ORDER BY role = 'Lead Mentor' DESC, name ASC
    `, [batchId, panelId]);

    const deadlines = await resolvePanelEvaluationDeadlines(batchId, panelId, studentInfo.batch_start_date, studentInfo.batch_end_date);
    const evalRow = evalRes.rows[0] || null;

    // Prerequisite checks: Attendance lock across all 4 activities & 6 mandatory forms
    const attLock = await checkPanelAttendanceLocked(pool, batchId, panelId);
    const studentFormsMap = await checkStudentFormsStatus(pool, batchId, [studentId]);
    const studentFormInfo = studentFormsMap[studentId] || { forms_completed: false, missing_forms: [] };

    // CRITICAL FIX: When SA explicitly unlocked the panel, Completed/Submitted individual evaluations
    // must NOT be considered locked — the admin has reopened the panel for editing.
    const isEvaluationLocked = Boolean(
      !deadlines.is_explicitly_unlocked &&
      (deadlines.is_evaluation_locked ||
       evalRow?.evaluation_status === 'Completed' ||
       evalRow?.evaluation_status === 'Submitted')
    );

    res.json({
      success: true,
      student: studentInfo,
      mentors: mentorsRes.rows,
      attendance: attendanceData,
      forms_summary: reconciledSummary,
      raw_forms_summary: formsSummaryRes.rows,
      undertaking: underRes.rows[0] || null,
      preparatory_checklist: prepRes.rows[0] || null,
      checklist: prepRes.rows[0] || null,
      institutional_visits: instRes.rows,
      family_surveys: famRes.rows,
      problem_identification: probRes.rows[0] || null,
      daily_activity: dailyActRes.rows[0] || null,
      daily_activity_report: dailyActRes.rows[0] || null,
      community_project: projRes.rows[0] || null,
      student_feedback: fbRes.rows[0] || null,
      evaluation: evalRow ? { ...evalRow, is_locked: isEvaluationLocked } : null,
      audit_history: auditRes.rows,
      is_evaluation_locked: isEvaluationLocked,
      is_attendance_locked: attLock.is_attendance_locked,
      attendance_lock: attLock,
      forms_completed: studentFormInfo.forms_completed,
      missing_forms: studentFormInfo.missing_forms,
      deadlines
    });
  } catch (err) {
    console.error('Error fetching student submission detail:', err);
    res.status(500).json({ message: 'Failed to load student submission details', error: err.message });
  }
};

// ─── 11. Save / Submit Faculty Evaluation ────────────────────────────────────
const saveStudentEvaluation = async (req, res) => {
  const client = await pool.connect();
  try {
    const scope = resolveFacultyScope(req, res, req.body.batch_id, req.body.panel_id);
    if (!scope.isValid) {
      client.release();
      return;
    }

    const { batchId, panelId } = scope;
    const studentId = parseInt(req.body.student_id, 10);
    const facultyUserId = req.user?.id;
    const facultyEmail = req.userEmail;
    const isSuperAdminOrAdmin = ['superadmin', 'superadmin-ri', 'ri_admin', 'admin'].includes(req.user?.role);

    // 0. Auto-Lock 15 Days After RI Visit Enforcement
    const batchDateRes = await client.query(`SELECT start_date, end_date FROM ri_batches WHERE id = $1`, [batchId]);
    const batchRow = batchDateRes.rows[0];
    const deadlines = await resolvePanelEvaluationDeadlines(batchId, panelId, batchRow?.start_date, batchRow?.end_date);
    if (deadlines.is_evaluation_locked && !isSuperAdminOrAdmin) {
      client.release();
      const formattedDead = deadlines.evaluation_deadline ? new Date(deadlines.evaluation_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      return res.status(403).json({
        success: false,
        message: `Evaluation is locked. The 15-day deadline following the RI field visit ended on ${formattedDead}. Submitting or editing evaluations is no longer permitted.`,
        is_locked: true,
        is_auto_locked: true,
        deadlines
      });
    }

    if (!studentId) {
      client.release();
      return res.status(400).json({ message: 'Valid student_id is required.' });
    }

    // Prerequisite 1: Panel attendance must be complete and locked across all 4 mandatory activities
    const attLock = await checkPanelAttendanceLocked(client, batchId, panelId);
    if (!attLock.is_attendance_locked && !isSuperAdminOrAdmin) {
      client.release();
      return res.status(403).json({
        success: false,
        message: `Evaluation Locked — Complete and lock attendance for all students in your assigned panel before proceeding. (${attLock.locked_activities_count} of ${attLock.total_activities_count} activities locked).`,
        attendance_locked: false,
        locked_activities_count: attLock.locked_activities_count,
        total_activities_count: attLock.total_activities_count
      });
    }

    // Prerequisite 2: Student must have submitted all 6 mandatory RI forms
    const formsMap = await checkStudentFormsStatus(client, batchId, [studentId]);
    const studentFormInfo = formsMap[studentId];
    if ((!studentFormInfo || !studentFormInfo.forms_completed) && !isSuperAdminOrAdmin) {
      client.release();
      const missingList = studentFormInfo?.missing_forms?.join(', ') || 'Mandatory forms pending';
      return res.status(403).json({
        success: false,
        message: `Evaluation blocked for this student: The following mandatory forms have not been submitted: ${missingList}.`,
        forms_completed: false,
        missing_forms: studentFormInfo?.missing_forms || []
      });
    }

    const evaluation_status = req.body.evaluation_status || req.body.status || 'Draft';
    const faculty_remarks = req.body.faculty_remarks || '';
    const correction_request_message = req.body.correction_request_message || req.body.correction_notes || '';

    const {
      attendance_marks,
      institutional_visit_rating,
      institutional_visits_rating,
      institutional_visit_marks,
      family_survey_rating,
      family_survey_marks,
      community_project_rating,
      community_projects_rating,
      community_project_marks,
      problem_statement_marks,
      problem_statement_score,
      smart_solution_marks,
      smart_solution_score,
      // Legacy compatibility fields if any client passes them:
      sdg_alignment_score,
      degree_relevance_score,
      joint_assignment_score,
      presentation_score,
      understanding_score,
      team_collaboration_rating,
      team_collaboration_marks
    } = req.body;

    // Check attendance for this student across the 4 activities
    const attRes = await client.query(`
      SELECT activity, status FROM ri_attendance
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, batchId]);

    const schoolStatus = attRes.rows.find(r => r.activity === 'SCHOOL_ACTIVITY')?.status || 'Absent';
    const instStatus = attRes.rows.find(r => r.activity === 'INSTITUTIONAL_VISIT')?.status || 'Absent';
    const famStatus = attRes.rows.find(r => r.activity === 'FAMILY_SURVEY')?.status || 'Absent';
    const commStatus = attRes.rows.find(r => r.activity === 'COMMUNITY_PROJECT')?.status || 'Absent';

    // Calculate marks using official rubric engine
    const { calculateRiEvaluation } = require('../utils/riEvaluationCalculator');
    const calc = calculateRiEvaluation({
      school_activity_status: schoolStatus,
      institutional_visit_status: instStatus,
      family_survey_status: famStatus,
      community_project_status: commStatus,
      attendance_marks,
      institutional_visit_rating: institutional_visit_rating || institutional_visits_rating,
      institutional_visit_marks,
      family_survey_rating,
      family_survey_marks,
      community_project_rating: community_project_rating || community_projects_rating,
      community_project_marks,
      problem_statement_marks: problem_statement_marks ?? problem_statement_score,
      smart_solution_marks: smart_solution_marks ?? smart_solution_score,
      sdg_alignment_score,
      degree_relevance_score,
      joint_assignment_score,
      presentation_score,
      understanding_score,
      team_collaboration_rating,
      team_collaboration_marks,
      evaluation_status
    });

    await client.query('BEGIN');

    // Atomic lock check: verify if evaluation is already locked
    const existingEvalRes = await client.query(
      `SELECT id, evaluation_status FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2 FOR UPDATE`,
      [studentId, batchId]
    );
    const existingEval = existingEvalRes.rows[0];

    if (!deadlines.is_explicitly_unlocked && existingEval && ['Completed', 'Submitted'].includes(existingEval.evaluation_status) && !isSuperAdminOrAdmin) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(409).json({
        success: false,
        message: 'This evaluation has been locked and cannot be modified.',
        is_locked: true
      });
    }

    const submittedAt = evaluation_status === 'Completed' ? new Date() : null;

    // Upsert ri_evaluations
    const evalRes = await client.query(`
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
        evaluator_faculty_id = EXCLUDED.evaluator_faculty_id,
        evaluator_faculty_email = EXCLUDED.evaluator_faculty_email,
        attendance_marks = EXCLUDED.attendance_marks,
        institutional_visit_rating = EXCLUDED.institutional_visit_rating,
        institutional_visit_marks = EXCLUDED.institutional_visit_marks,
        family_survey_rating = EXCLUDED.family_survey_rating,
        family_survey_marks = EXCLUDED.family_survey_marks,
        community_project_rating = EXCLUDED.community_project_rating,
        community_project_marks = EXCLUDED.community_project_marks,
        problem_statement_marks = EXCLUDED.problem_statement_marks,
        smart_solution_marks = EXCLUDED.smart_solution_marks,
        sdg_alignment_score = EXCLUDED.sdg_alignment_score,
        degree_relevance_score = EXCLUDED.degree_relevance_score,
        smart_solution_score = EXCLUDED.smart_solution_score,
        joint_assignment_score = EXCLUDED.joint_assignment_score,
        presentation_score = EXCLUDED.presentation_score,
        understanding_score = EXCLUDED.understanding_score,
        problem_solution_marks = EXCLUDED.problem_solution_marks,
        team_collaboration_rating = EXCLUDED.team_collaboration_rating,
        team_collaboration_marks = EXCLUDED.team_collaboration_marks,
        total_marks = EXCLUDED.total_marks,
        overall_grade = EXCLUDED.overall_grade,
        evaluation_status = EXCLUDED.evaluation_status,
        faculty_remarks = EXCLUDED.faculty_remarks,
        correction_request_message = EXCLUDED.correction_request_message,
        submitted_at = COALESCE(EXCLUDED.submitted_at, ri_evaluations.submitted_at),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      studentId, batchId, panelId, facultyUserId, facultyEmail,
      calc.attendance_marks,
      calc.institutional_visit_rating, calc.institutional_visit_marks,
      calc.family_survey_rating, calc.family_survey_marks,
      calc.community_project_rating, calc.community_project_marks,
      calc.problem_statement_marks,
      calc.smart_solution_marks,
      calc.problem_statement_marks, // legacy fallback for sdg_alignment_score
      0, // degree_relevance_score
      calc.smart_solution_marks, // legacy smart_solution_score
      0, // joint_assignment_score
      0, // presentation_score
      0, // understanding_score
      calc.smart_solution_marks, // legacy problem_solution_marks
      calc.institutional_visit_rating || 'Good',
      0,
      calc.total_marks, calc.overall_grade,
      evaluation_status,
      faculty_remarks || null,
      correction_request_message || null,
      submittedAt
    ]);

    // If 'Requires Correction', mark affected forms as 'Requires Correction' with the message
    if (evaluation_status === 'Requires Correction') {
      await client.query(`
        UPDATE ri_student_forms
        SET 
          status = 'Requires Correction',
          correction_notes = $1,
          reviewed_by_faculty_id = $2,
          reviewed_at = CURRENT_TIMESTAMP,
          last_updated_at = CURRENT_TIMESTAMP
        WHERE student_id = $3 AND ri_batch_id = $4 AND status = 'Submitted'
      `, [correction_request_message, facultyUserId, studentId, batchId]);
    } else if (evaluation_status === 'Completed') {
      // Mark submitted forms as Reviewed
      await client.query(`
        UPDATE ri_student_forms
        SET 
          status = 'Reviewed',
          faculty_remarks = $1,
          reviewed_by_faculty_id = $2,
          reviewed_at = CURRENT_TIMESTAMP,
          last_updated_at = CURRENT_TIMESTAMP
        WHERE student_id = $3 AND ri_batch_id = $4 AND status IN ('Submitted', 'Requires Correction')
      `, [faculty_remarks, facultyUserId, studentId, batchId]);

      // Check if all students in this panel are now Completed
      const panelCheck = await client.query(`
        SELECT 
          COUNT(rbs.student_id)::int as total_students,
          COUNT(CASE WHEN e.evaluation_status = 'Completed' THEN 1 END)::int as completed_students
        FROM ri_batch_students rbs
        LEFT JOIN ri_evaluations e ON rbs.student_id = e.student_id AND rbs.ri_batch_id = e.ri_batch_id
        WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      `, [batchId, panelId]);
      const totalStudents = panelCheck.rows[0]?.total_students || 0;
      const completedStudents = panelCheck.rows[0]?.completed_students || 0;
      if (totalStudents > 0 && completedStudents >= totalStudents) {
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
        `, [batchId, panelId, facultyEmail, facultyUserId]);
      }
    }

    await client.query('COMMIT');
    client.release();

    // Log action to Audit Trail
    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: facultyUserId,
      userEmail: facultyEmail,
      userName: req.user?.name,
      userRole: 'faculty',
      action: evaluation_status === 'Requires Correction' ? 'REQUEST_CORRECTION' : (evaluation_status === 'Completed' ? 'SUBMIT_EVALUATION' : 'SAVE_EVALUATION_DRAFT'),
      studentId,
      batchId,
      panelId,
      recordId: evalRes.rows[0]?.id,
      details: {
        total_marks: calc.total_marks,
        grade: calc.overall_grade,
        status: evaluation_status,
        remarks: faculty_remarks
      }
    });

    res.json({
      success: true,
      message: evaluation_status === 'Completed' ? 'Evaluation finalized successfully.' : (evaluation_status === 'Requires Correction' ? 'Correction request sent to student.' : 'Evaluation draft saved.'),
      evaluation: evalRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error saving student evaluation:', err);
    res.status(500).json({ message: 'Failed to save evaluation', error: err.message });
  }
};

// ─── 10b. Get All Panel Student Evaluations (Single Panel Bulk Table) ───────────
const getPanelEvaluations = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const search = (req.query.search || '').trim();

    // Check deadlines with Super Admin lock overrides
    const batchDateRes = await pool.query(`SELECT start_date, end_date FROM ri_batches WHERE id = $1`, [batchId]);
    const batchRow = batchDateRes.rows[0];
    const deadlines = await resolvePanelEvaluationDeadlines(batchId, panelId, batchRow?.start_date, batchRow?.end_date);

    let query = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        COALESCE(u.roll_number, rbs.ri_id) as roll_number,
        rbs.ri_id,
        u.department,
        u.division,
        u.gender,
        sch.status as school_status,
        inst.status as inst_status,
        fam.status as fam_status,
        comm.status as comm_status,
        e.id as evaluation_id,
        e.attendance_marks,
        e.institutional_visit_rating,
        e.institutional_visit_marks,
        e.family_survey_rating,
        e.family_survey_marks,
        e.community_project_rating,
        e.community_project_marks,
        e.problem_statement_marks,
        COALESCE(e.smart_solution_marks, e.problem_solution_marks) as smart_solution_marks,
        e.total_marks,
        e.overall_grade,
        COALESCE(e.evaluation_status, 'Draft') as evaluation_status,
        e.faculty_remarks,
        fac.name as evaluator_name,
        e.updated_at as evaluated_at
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_attendance sch ON sch.student_id = u.id AND sch.ri_batch_id = $1 AND sch.ri_panel_id = $2 AND sch.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance inst ON inst.student_id = u.id AND inst.ri_batch_id = $1 AND inst.ri_panel_id = $2 AND inst.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance fam ON fam.student_id = u.id AND fam.ri_batch_id = $1 AND fam.ri_panel_id = $2 AND fam.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance comm ON comm.student_id = u.id AND comm.ri_batch_id = $1 AND comm.ri_panel_id = $2 AND comm.activity = 'COMMUNITY_PROJECT'
      LEFT JOIN ri_evaluations e ON e.student_id = u.id AND e.ri_batch_id = $1
      LEFT JOIN users fac ON e.evaluator_faculty_id = fac.id
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
    `;

    const params = [batchId, panelId];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER(u.name) LIKE $3 OR LOWER(u.prn) LIKE $3 OR LOWER(rbs.ri_id) LIKE $3)`;
    }

    query += ` ORDER BY u.roll_number ASC, u.name ASC`;

    const result = await pool.query(query, params);

    // Check panel attendance lock across 4 mandatory activities
    const attendanceLock = await checkPanelAttendanceLocked(pool, batchId, panelId);

    // Check student form submission status for all 6 mandatory forms
    const studentIds = result.rows.map(r => r.student_id);
    const formsStatusMap = await checkStudentFormsStatus(pool, batchId, studentIds);

    const ATT_MAP = { 4: 15.00, 3: 11.25, 2: 7.50, 1: 3.75, 0: 0.00 };
    const isPresent = (st) => String(st || '').toLowerCase() === 'present' || String(st || '').toLowerCase() === 'p';

    // Panel-level administrative lock state (from ri_evaluation_locks via resolvePanelEvaluationDeadlines).
    // deadlines.is_evaluation_locked:   true  → panel is administratively locked (deadline or SA-locked)
    // deadlines.is_explicitly_unlocked: true  → SA has explicitly unlocked; overrides Completed status
    // deadlines.is_explicitly_locked:   true  → SA has explicitly locked the panel
    const isPanelAdminLocked = deadlines.is_evaluation_locked === true;
    const isExplicitlyUnlocked = deadlines.is_explicitly_unlocked === true;

    const students = result.rows.map(row => {
      let presentCount = 0;
      if (isPresent(row.school_status)) presentCount++;
      if (isPresent(row.inst_status)) presentCount++;
      if (isPresent(row.fam_status)) presentCount++;
      if (isPresent(row.comm_status)) presentCount++;

      const autoAttendanceMarks = ATT_MAP[presentCount] ?? Number((presentCount * 3.75).toFixed(2));
      const hasEval = !!row.evaluation_id;
      const evalStatus = hasEval ? (row.evaluation_status || 'Draft') : 'Not Evaluated';

      const formInfo = formsStatusMap[row.student_id] || {
        forms_completed: false,
        missing_forms: [
          'Student Undertaking',
          'Form IIIB — Daily Activity Report',
          'Form IV — Institutional Visits',
          'Form V — Family Visits',
          'Form VI — Problem / Issue Identification & Solution',
          'Form VIII — RI Feedback Form'
        ],
        statuses: {}
      };

      // CRITICAL FIX: When Super Admin has explicitly unlocked the panel,
      // individual Completed/Submitted evaluation_status must NOT cause is_locked=true.
      // Panel-level admin lock is the authoritative source of truth.
      // Student-level "Completed" means the evaluation data exists — it does not mean the
      // panel is still locked when an admin has explicitly opened it for editing.
      let isLocked;
      if (isExplicitlyUnlocked) {
        // SA unlocked: only the deadline-based or SA explicit re-lock can lock it, not student status
        isLocked = false;
      } else {
        // Default: panel admin lock OR student evaluation completed/submitted
        isLocked = Boolean(isPanelAdminLocked || evalStatus === 'Completed' || evalStatus === 'Submitted');
      }

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
        evaluation_status: evalStatus,
        is_locked: isLocked,
        forms_completed: formInfo.forms_completed,
        missing_forms: formInfo.missing_forms,
        forms_statuses: formInfo.statuses
      };
    });

    // Panel is considered "all locked" only if the admin lock is active OR every student is individually locked.
    // An explicit SuperAdmin unlock means allLocked must be false even if all students are Completed.
    const allLocked = !isExplicitlyUnlocked && students.length > 0 && students.every(s => s.is_locked);

    res.json({
      success: true,
      batch_id: batchId,
      panel_id: panelId,
      deadlines,
      // panel_lock is the single authoritative source for the panel-level admin lock status
      panel_lock: {
        is_locked: isPanelAdminLocked,
        is_explicitly_unlocked: isExplicitlyUnlocked,
        is_explicitly_locked: deadlines.is_explicitly_locked === true,
        unlocked_at: deadlines.unlocked_at || null,
        unlocked_by_email: deadlines.unlocked_by_email || null,
        locked_at: deadlines.locked_at || null,
        locked_by_email: deadlines.locked_by_email || null
      },
      is_locked: isPanelAdminLocked,
      all_evaluations_locked: allLocked,
      attendance_lock: attendanceLock,
      students,
      total: students.length
    });
  } catch (err) {
    console.error('Error in getPanelEvaluations:', err);
    res.status(500).json({ message: 'Failed to load panel evaluations', error: err.message });
  }
};

// ─── 10c. Bulk Save / Submit Faculty Evaluations ────────────────────────────────
const saveBulkEvaluations = async (req, res) => {
  const client = await pool.connect();
  try {
    const scope = resolveFacultyScope(req, res, req.body.batch_id, req.body.panel_id);
    if (!scope.isValid) {
      client.release();
      return;
    }

    const { batchId, panelId } = scope;
    const facultyUserId = req.user?.id;
    const facultyEmail = req.userEmail;
    const isSuperAdminOrAdmin = ['superadmin', 'superadmin-ri', 'ri_admin', 'admin'].includes(req.user?.role);

    // Auto-lock deadline check with Super Admin lock overrides
    const batchDateRes = await client.query(`SELECT start_date, end_date FROM ri_batches WHERE id = $1`, [batchId]);
    const batchRow = batchDateRes.rows[0];
    const deadlines = await resolvePanelEvaluationDeadlines(batchId, panelId, batchRow?.start_date, batchRow?.end_date);
    if (deadlines.is_evaluation_locked && !isSuperAdminOrAdmin) {
      client.release();
      const formattedDead = deadlines.evaluation_deadline ? new Date(deadlines.evaluation_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      return res.status(403).json({
        success: false,
        message: `Evaluation is locked. The 15-day deadline following the RI field visit ended on ${formattedDead}. Submitting or editing evaluations is no longer permitted.`,
        is_locked: true
      });
    }

    const evaluations = Array.isArray(req.body.evaluations) ? req.body.evaluations : [];
    if (evaluations.length === 0) {
      client.release();
      return res.status(400).json({ message: 'No evaluation records provided.' });
    }

    // Prerequisite 1: Panel attendance must be complete and locked across all 4 mandatory activities
    const attLock = await checkPanelAttendanceLocked(client, batchId, panelId);
    if (!attLock.is_attendance_locked && !isSuperAdminOrAdmin) {
      client.release();
      return res.status(403).json({
        success: false,
        message: `Evaluation Locked — Complete and lock attendance for all students in your assigned panel before proceeding. (${attLock.locked_activities_count} of ${attLock.total_activities_count} activities locked).`,
        attendance_locked: false,
        locked_activities_count: attLock.locked_activities_count,
        total_activities_count: attLock.total_activities_count
      });
    }

    // Prerequisite 2: Check student form submission for all students in evaluations array
    if (!isSuperAdminOrAdmin) {
      const studentIds = evaluations.map(item => parseInt(item.student_id, 10)).filter(Boolean);
      const formsMap = await checkStudentFormsStatus(client, batchId, studentIds);

      const ineligible = evaluations.filter(item => {
        const sId = parseInt(item.student_id, 10);
        return !formsMap[sId] || !formsMap[sId].forms_completed;
      });

      if (ineligible.length > 0) {
        client.release();
        return res.status(403).json({
          success: false,
          message: `Bulk evaluation cannot be saved: ${ineligible.length} student(s) have pending mandatory forms. All 6 mandatory forms must be submitted before evaluation.`,
          ineligible_students: ineligible.map(e => ({
            student_id: e.student_id,
            missing_forms: formsMap[parseInt(e.student_id, 10)]?.missing_forms || []
          }))
        });
      }
    }

    const { calculateRiEvaluation } = require('../utils/riEvaluationCalculator');

    await client.query('BEGIN');

    // Atomic lock check: Reject if any evaluation in this batch is already locked (unless explicitly unlocked by Super Admin)
    if (!deadlines.is_explicitly_unlocked) {
      for (const item of evaluations) {
        const sId = parseInt(item.student_id, 10);
        if (!sId) continue;

        const existingRes = await client.query(
          `SELECT id, evaluation_status FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2 FOR UPDATE`,
          [sId, batchId]
        );
        const existing = existingRes.rows[0];

        if (existing && ['Completed', 'Submitted'].includes(existing.evaluation_status) && !isSuperAdminOrAdmin) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(409).json({
            success: false,
            message: 'This evaluation has been locked and cannot be modified.',
            is_locked: true,
            student_id: sId
          });
        }
      }
    }

    const updatedRecords = [];

    for (const item of evaluations) {
      const studentId = parseInt(item.student_id, 10);
      if (!studentId) continue;

      const evalStatus = item.evaluation_status || item.status || 'Draft';
      const facultyRemarks = item.faculty_remarks || '';

      // Check attendance records for this student
      const attRes = await client.query(`
        SELECT activity, status FROM ri_attendance
        WHERE student_id = $1 AND ri_batch_id = $2
      `, [studentId, batchId]);

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

      const upsertRes = await client.query(`
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
          evaluator_faculty_id = EXCLUDED.evaluator_faculty_id,
          evaluator_faculty_email = EXCLUDED.evaluator_faculty_email,
          attendance_marks = EXCLUDED.attendance_marks,
          institutional_visit_rating = EXCLUDED.institutional_visit_rating,
          institutional_visit_marks = EXCLUDED.institutional_visit_marks,
          family_survey_rating = EXCLUDED.family_survey_rating,
          family_survey_marks = EXCLUDED.family_survey_marks,
          community_project_rating = EXCLUDED.community_project_rating,
          community_project_marks = EXCLUDED.community_project_marks,
          problem_statement_marks = EXCLUDED.problem_statement_marks,
          smart_solution_marks = EXCLUDED.smart_solution_marks,
          sdg_alignment_score = EXCLUDED.sdg_alignment_score,
          degree_relevance_score = EXCLUDED.degree_relevance_score,
          smart_solution_score = EXCLUDED.smart_solution_score,
          joint_assignment_score = EXCLUDED.joint_assignment_score,
          presentation_score = EXCLUDED.presentation_score,
          understanding_score = EXCLUDED.understanding_score,
          problem_solution_marks = EXCLUDED.problem_solution_marks,
          team_collaboration_rating = EXCLUDED.team_collaboration_rating,
          team_collaboration_marks = EXCLUDED.team_collaboration_marks,
          total_marks = EXCLUDED.total_marks,
          overall_grade = EXCLUDED.overall_grade,
          evaluation_status = EXCLUDED.evaluation_status,
          faculty_remarks = EXCLUDED.faculty_remarks,
          submitted_at = COALESCE(EXCLUDED.submitted_at, ri_evaluations.submitted_at),
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, student_id, total_marks, overall_grade, evaluation_status
      `, [
        studentId, batchId, panelId, facultyUserId, facultyEmail,
        calc.attendance_marks,
        calc.institutional_visit_rating, calc.institutional_visit_marks,
        calc.family_survey_rating, calc.family_survey_marks,
        calc.community_project_rating, calc.community_project_marks,
        calc.problem_statement_marks,
        calc.smart_solution_marks,
        calc.problem_statement_marks,
        0,
        calc.smart_solution_marks,
        0, 0, 0,
        calc.smart_solution_marks,
        calc.institutional_visit_rating || 'Good',
        0,
        calc.total_marks, calc.overall_grade,
        evalStatus,
        facultyRemarks || null,
        null,
        submittedAt
      ]);

      if (evalStatus === 'Completed') {
        await client.query(`
          UPDATE ri_student_forms
          SET 
            status = 'Reviewed',
            faculty_remarks = $1,
            reviewed_by_faculty_id = $2,
            reviewed_at = CURRENT_TIMESTAMP,
            last_updated_at = CURRENT_TIMESTAMP
          WHERE student_id = $3 AND ri_batch_id = $4 AND status IN ('Submitted', 'Requires Correction')
        `, [facultyRemarks, facultyUserId, studentId, batchId]);
      }

      updatedRecords.push(upsertRes.rows[0]);
    }

    // Check if all students in this panel are now Completed
    const panelEvalStatusCheck = await client.query(`
      SELECT 
        COUNT(rbs.student_id)::int as total_students,
        COUNT(CASE WHEN e.evaluation_status = 'Completed' THEN 1 END)::int as completed_students
      FROM ri_batch_students rbs
      LEFT JOIN ri_evaluations e ON rbs.student_id = e.student_id AND rbs.ri_batch_id = e.ri_batch_id
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
    `, [batchId, panelId]);

    const totalStudents = panelEvalStatusCheck.rows[0]?.total_students || 0;
    const completedStudents = panelEvalStatusCheck.rows[0]?.completed_students || 0;

    if (totalStudents > 0 && completedStudents >= totalStudents) {
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
      `, [batchId, panelId, facultyEmail, facultyUserId]);
    }

    await client.query('COMMIT');
    client.release();

    res.json({
      success: true,
      count: updatedRecords.length,
      evaluations: updatedRecords,
      message: `Successfully saved ${updatedRecords.length} student evaluations.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error in saveBulkEvaluations:', err);
    res.status(500).json({ message: 'Failed to bulk save evaluations', error: err.message });
  }
};

// ─── 12. Multi-Sheet Excel Exports ───────────────────────────────────────────
const downloadAttendanceExcel = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { createAttendanceWorkbook } = require('../utils/riExcelExport');

    // Panel info
    const panelRes = await pool.query(`
      SELECT rp.panel_number, rp.name as panel_name, rb.name as batch_name, v.name as village_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);
    const panelInfo = panelRes.rows[0] || {};

    // Students with 4 activities attendance
    const dataRes = await pool.query(`
      SELECT 
        u.id as student_id,
        COALESCE(rbs.ri_id, u.roll_number, '') as ri_id,
        u.name as student_name,
        u.prn,
        u.department,
        u.division,
        u.gender,
        u.phone,
        sch.status as school_status,
        sch.date as school_date,
        sch.marked_by_email as school_marked_by,
        sch.remarks as school_remarks,
        inst.status as inst_status,
        inst.date as inst_date,
        inst.marked_by_email as inst_marked_by,
        inst.remarks as inst_remarks,
        fam.status as fam_status,
        fam.date as fam_date,
        fam.marked_by_email as fam_marked_by,
        fam.remarks as fam_remarks,
        comm.status as comm_status,
        comm.date as comm_date,
        comm.marked_by_email as comm_marked_by,
        comm.remarks as comm_remarks
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_attendance sch ON sch.student_id = u.id AND sch.ri_batch_id = $1 AND sch.ri_panel_id = $2 AND sch.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance inst ON inst.student_id = u.id AND inst.ri_batch_id = $1 AND inst.ri_panel_id = $2 AND inst.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance fam ON fam.student_id = u.id AND fam.ri_batch_id = $1 AND fam.ri_panel_id = $2 AND fam.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance comm ON comm.student_id = u.id AND comm.ri_batch_id = $1 AND comm.ri_panel_id = $2 AND comm.activity = 'COMMUNITY_PROJECT'
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      ORDER BY u.roll_number ASC, u.name ASC
    `, [batchId, panelId]);

    const summaryRows = dataRes.rows.map((s, idx) => {
      const sch = s.school_status || 'Unmarked';
      const inst = s.inst_status || 'Unmarked';
      const fam = s.fam_status || 'Unmarked';
      const comm = s.comm_status || 'Unmarked';

      const presentCount = (sch === 'Present' ? 1 : 0) + (inst === 'Present' ? 1 : 0) + (fam === 'Present' ? 1 : 0) + (comm === 'Present' ? 1 : 0);
      const pct = `${Math.round((presentCount / 4) * 100)}%`;

      return {
        'Sr. No.': idx + 1,
        'PRN': String(s.prn || ''),
        'Student Name': s.student_name,
        'Roll / RI ID': s.ri_id,
        'Department': s.department || '',
        'Batch': panelInfo.batch_name || '',
        'Panel': `P${panelInfo.panel_number}: ${panelInfo.panel_name}`,
        'Village': panelInfo.village_name || 'Not Allocated',
        'School Activity': sch,
        'Institutional Visit': inst,
        'Family Visit': fam,
        'Community Project': comm,
        'Activities Present': `${presentCount} / 4`,
        'Attendance %': pct,
        'Status': presentCount === 4 ? 'Complete (100%)' : (presentCount > 0 ? `Partial (${pct})` : 'Absent (0%)')
      };
    });

    const buildActivityRows = (statusKey, dateKey, markedByKey, remarksKey) => {
      return dataRes.rows.map((s, idx) => ({
        'Sr. No.': idx + 1,
        'PRN': String(s.prn || ''),
        'Student Name': s.student_name,
        'Panel': `P${panelInfo.panel_number}`,
        'Village': panelInfo.village_name || '',
        'Status': s[statusKey] || 'Unmarked',
        'Date': s[dateKey] ? String(s[dateKey]).split('T')[0] : '-',
        'Marked By': s[markedByKey] || '-',
        'Remarks': s[remarksKey] || '-'
      }));
    };

    const schoolActivityRows = buildActivityRows('school_status', 'school_date', 'school_marked_by', 'school_remarks');
    const institutionalVisitRows = buildActivityRows('inst_status', 'inst_date', 'inst_marked_by', 'inst_remarks');
    const familySurveyRows = buildActivityRows('fam_status', 'fam_date', 'fam_marked_by', 'fam_remarks');
    const communityProjectRows = buildActivityRows('comm_status', 'comm_date', 'comm_marked_by', 'comm_remarks');

    const buffer = createAttendanceWorkbook({
      batchName: panelInfo.batch_name,
      panelName: panelInfo.panel_name,
      summaryRows,
      schoolActivityRows,
      institutionalVisitRows,
      familySurveyRows,
      communityProjectRows
    });

    const filename = `RI_Attendance_P${panelInfo.panel_number || 'Sheet'}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading attendance excel:', err);
    res.status(500).json({ message: 'Failed to download attendance excel', error: err.message });
  }
};

const downloadStudentFormsExcel = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { createFormsWorkbook } = require('../utils/riExcelExport');

    const panelRes = await pool.query(`
      SELECT rp.panel_number, rp.name as panel_name, rb.name as batch_name, v.name as village_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);
    const panelInfo = panelRes.rows[0] || {};

    const dataRes = await pool.query(`
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number, '') as ri_id,
        u.department,
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'UNDERTAKING') as undertaking_status,
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'PREPARATORY_CHECKLIST') as checklist_status,
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'INSTITUTIONAL_VISIT') as institutional_status,
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'FAMILY_SURVEY') as family_status,
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'PROBLEM_IDENTIFICATION') as problem_status,
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'COMMUNITY_PROJECT') as project_status,
        (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'STUDENT_FEEDBACK') as feedback_status
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      ORDER BY u.roll_number ASC, u.name ASC
    `, [batchId, panelId]);

    const summaryRows = dataRes.rows.map((s, idx) => {
      const statuses = [
        s.undertaking_status, s.checklist_status, s.institutional_status,
        s.family_status, s.problem_status, s.project_status, s.feedback_status
      ];
      const submitted = statuses.filter(st => st === 'Submitted' || st === 'Reviewed').length;
      return {
        'Sr. No.': idx + 1,
        'PRN': String(s.prn || ''),
        'Student Name': s.student_name,
        'Department': s.department || '',
        'Panel': `P${panelInfo.panel_number}: ${panelInfo.panel_name}`,
        'Undertaking': s.undertaking_status || 'Not Started',
        'Checklist': s.checklist_status || 'Not Started',
        'Institutional Visits': s.institutional_status || 'Not Started',
        'Family Visit': s.family_status || 'Not Started',
        'Problem & Solution': s.problem_status || 'Not Started',
        'Community Project': s.project_status || 'Not Started',
        'Student Feedback': s.feedback_status || 'Not Started',
        'Completed Forms': `${submitted} / 7`,
        'Completion %': `${Math.round((submitted / 7) * 100)}%`
      };
    });

    // Form responses detailed
    const responsesRes = await pool.query(`
      SELECT 
        u.name as student_name,
        u.prn,
        sf.form_type,
        sf.status,
        sf.submission_timestamp,
        sf.reviewed_at,
        sf.faculty_remarks,
        sf.correction_notes
      FROM ri_student_forms sf
      JOIN users u ON sf.student_id = u.id
      WHERE sf.ri_batch_id = $1 AND sf.ri_panel_id = $2
      ORDER BY sf.submission_timestamp DESC NULLS LAST
    `, [batchId, panelId]);

    const responsesRows = responsesRes.rows.map((r, idx) => ({
      'Sr. No.': idx + 1,
      'PRN': String(r.prn || ''),
      'Student Name': r.student_name,
      'Form Type': r.form_type,
      'Status': r.status,
      'Submitted At': r.submission_timestamp ? String(r.submission_timestamp).split('T')[0] : '-',
      'Reviewed At': r.reviewed_at ? String(r.reviewed_at).split('T')[0] : '-',
      'Faculty Remarks': r.faculty_remarks || '-',
      'Correction Notes': r.correction_notes || '-'
    }));

    // Pending forms
    const pendingRows = [];
    dataRes.rows.forEach(s => {
      const pendingList = [];
      if (!['Submitted', 'Reviewed'].includes(s.undertaking_status)) pendingList.push('Undertaking');
      if (!['Submitted', 'Reviewed'].includes(s.checklist_status)) pendingList.push('Checklist');
      if (!['Submitted', 'Reviewed'].includes(s.institutional_status)) pendingList.push('Institutional Visits');
      if (!['Submitted', 'Reviewed'].includes(s.family_status)) pendingList.push('Family Visit');
      if (!['Submitted', 'Reviewed'].includes(s.problem_status)) pendingList.push('Problem Identification');
      if (!['Submitted', 'Reviewed'].includes(s.project_status)) pendingList.push('Community Project');
      if (!['Submitted', 'Reviewed'].includes(s.feedback_status)) pendingList.push('Student Feedback');

      if (pendingList.length > 0) {
        pendingRows.push({
          'PRN': String(s.prn || ''),
          'Student Name': s.student_name,
          'Department': s.department || '',
          'Pending Count': pendingList.length,
          'Pending Forms List': pendingList.join(', ')
        });
      }
    });

    const buffer = createFormsWorkbook({ summaryRows, responsesRows, pendingRows });
    const filename = `RI_Student_Forms_P${panelInfo.panel_number || 'Sheet'}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading forms excel:', err);
    res.status(500).json({ message: 'Failed to download student forms excel', error: err.message });
  }
};

const downloadEvaluationExcel = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { createEvaluationWorkbook } = require('../utils/riExcelExport');

    const panelRes = await pool.query(`
      SELECT rp.panel_number, rp.name as panel_name, rb.name as batch_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);
    const panelInfo = panelRes.rows[0] || {};

    const evalRes = await pool.query(`
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number, '') as ri_id,
        u.department,
        e.*,
        fac.name as evaluator_name
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_evaluations e ON e.student_id = u.id AND e.ri_batch_id = $1
      LEFT JOIN users fac ON e.evaluator_faculty_id = fac.id
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      ORDER BY u.roll_number ASC, u.name ASC
    `, [batchId, panelId]);

    const summaryRows = evalRes.rows.map((s, idx) => ({
      'Sr. No.': idx + 1,
      'PRN': String(s.prn || ''),
      'Student Name': s.student_name,
      'Department': s.department || '',
      'Evaluator Faculty': s.evaluator_name || 'Pending',
      'Attendance (15%)': Number(s.attendance_marks || 0).toFixed(2),
      'Institutional Visit (10%)': Number(s.institutional_visit_marks || 0).toFixed(2),
      'Family Visit (10%)': Number(s.family_survey_marks || 0).toFixed(2),
      'Community Project (10%)': Number(s.community_project_marks || 0).toFixed(2),
      'Problem Statement & SDGs (15%)': Number(s.problem_statement_marks || 0).toFixed(2),
      'Proposed Smart Solution (40%)': Number(s.smart_solution_marks || s.problem_solution_marks || 0).toFixed(2),
      'Total Marks (100)': Number(s.total_marks || 0).toFixed(2),
      'Letter Grade': s.overall_grade || 'Pending',
      'Evaluation Status': s.evaluation_status || 'Pending'
    }));

    const criterionRows = evalRes.rows.map((s, idx) => ({
      'Sr. No.': idx + 1,
      'PRN': String(s.prn || ''),
      'Student Name': s.student_name,
      'Attendance (15 Marks)': Number(s.attendance_marks || 0).toFixed(2),
      'Institutional Visit (10 Marks)': Number(s.institutional_visit_marks || 0).toFixed(2),
      'Family Visit (10 Marks)': Number(s.family_survey_marks || 0).toFixed(2),
      'Community Project (10 Marks)': Number(s.community_project_marks || 0).toFixed(2),
      'Problem Statement Identification & SDGs (15 Marks)': Number(s.problem_statement_marks || 0).toFixed(2),
      'Proposed SMART Solution (40 Marks)': Number(s.smart_solution_marks || s.problem_solution_marks || 0).toFixed(2),
      'Total Marks (100)': Number(s.total_marks || 0).toFixed(2)
    }));

    const remarksRows = evalRes.rows.map((s, idx) => ({
      'Sr. No.': idx + 1,
      'PRN': String(s.prn || ''),
      'Student Name': s.student_name,
      'Evaluator': s.evaluator_name || '-',
      'Status': s.evaluation_status || 'Pending',
      'Faculty Remarks': s.faculty_remarks || 'None',
      'Correction Request Notes': s.correction_request_message || 'None'
    }));

    const buffer = createEvaluationWorkbook({ summaryRows, criterionRows, remarksRows });
    const filename = `RI_Evaluation_P${panelInfo.panel_number || 'Sheet'}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading evaluation excel:', err);
    res.status(500).json({ message: 'Failed to download evaluation excel', error: err.message });
  }
};

const downloadFamilySurveysExcel = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { createFamilySurveyWorkbook } = require('../utils/riExcelExport');

    const panelRes = await pool.query(`
      SELECT rp.panel_number, rp.name as panel_name, rb.name as batch_name, v.name as village_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);
    const panelInfo = panelRes.rows[0] || {};

    const sumRes = await pool.query(`
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        COUNT(f.id)::int as families_count,
        COALESCE(sf.status, 'Not Started') as survey_status
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_family_surveys f ON f.student_id = u.id AND f.ri_batch_id = $1
      LEFT JOIN ri_student_forms sf ON sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'FAMILY_SURVEY'
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      GROUP BY u.id, u.name, u.prn, sf.status, u.roll_number
      ORDER BY u.roll_number ASC, u.name ASC
    `, [batchId, panelId]);

    const summaryRows = sumRes.rows.map((s, idx) => ({
      'Sr. No.': idx + 1,
      'PRN': String(s.prn || ''),
      'Student Name': s.student_name,
      'Panel': `P${panelInfo.panel_number}`,
      'Village': panelInfo.village_name || '',
      'Households Surveyed': s.families_count,
      'Required Target': 5,
      'Survey Status': s.survey_status
    }));

    const detRes = await pool.query(`
      SELECT 
        u.name as student_name,
        u.prn,
        f.*
      FROM ri_family_surveys f
      JOIN users u ON f.student_id = u.id
      WHERE f.ri_batch_id = $1 AND f.ri_panel_id = $2
      ORDER BY u.name ASC, f.family_serial_number ASC
    `, [batchId, panelId]);

    const detailRows = detRes.rows.map((f, idx) => {
      const sd = (f.survey_data && typeof f.survey_data === 'object') ? f.survey_data : {};
      const formatVal = (v) => Array.isArray(v) ? v.join(', ') : (v !== undefined && v !== null ? String(v) : '');

      return {
        'Sr. No.': idx + 1,
        'Student PRN': String(f.prn || ''),
        'Student Name': f.student_name,
        'Family Sr.': f.family_serial_number,
        'Head of Family': f.head_of_family_name,
        'Total Members': f.total_family_members,
        'Male Members': f.male_members,
        'Female Members': f.female_members,

        // SECTION A
        'A.1 House Type': formatVal(sd.a_1_house_type || f.house_type),
        'A.2 House Ownership': formatVal(sd.a_2_house_ownership || f.house_ownership),
        'A.3 Rooms Count': formatVal(sd.a_3_rooms_count),
        'A.4 Ventilation': formatVal(sd.a_4_ventilation),

        // SECTION B
        'B.1 Electricity': formatVal(sd.b_1_electricity !== undefined ? sd.b_1_electricity : (f.electricity_available ? 'Yes' : 'No')),
        'B.2 Tap Water': formatVal(sd.b_2_tap_water),
        'B.3 Latrine': formatVal(sd.b_3_latrine),
        'B.4 Mobile Phones': formatVal(sd.b_4_mobile_phones || f.mobile_phones_level),
        'B.5 Vehicles': formatVal(sd.b_5_vehicles),
        'B.6 Television': formatVal(sd.b_6_television),

        // SECTION C
        'C.1 Agricultural Land': formatVal(sd.c_1_agri_land || f.agricultural_land),
        'C.2 Crops Grown': formatVal(sd.c_2_crops_grown || f.primary_crop),
        'C.3 Cows Count': formatVal(sd.c_3_cows_count),
        'C.4 Buffaloes Count': formatVal(sd.c_4_buffaloes_count),
        'C.5 Goats/Sheep Count': formatVal(sd.c_5_goats_sheep_count),
        'C.6 Bullocks Count': formatVal(sd.c_6_bullocks_count),
        'C.7 Poultry Birds': formatVal(sd.c_7_poultry_birds_count),
        'C.8 Farm Machinery': formatVal(sd.c_8_farm_machinery),

        // SECTION D
        'D.1 Pulses/Dal Frequency': formatVal(sd.d_1_pulses_dal || f.diet_dal_frequency),
        'D.2 Green Veg Frequency': formatVal(sd.d_2_green_veg || f.diet_green_veg_frequency),
        'D.3 Fruits Frequency': formatVal(sd.d_3_fruits || f.diet_fruits_frequency),
        'D.4 Milk per day': formatVal(sd.d_4_milk_per_day),

        // SECTION E
        'E.1 Farming Occupation': formatVal(sd.e_1_farming_occupation),
        'E.2 Farm Labor': formatVal(sd.e_2_farm_labor_occupation),
        'E.3 Other Labor': formatVal(sd.e_3_other_labor_occupation),
        'E.4 Govt Job': formatVal(sd.e_4_govt_job_occupation),
        'E.5 Private Job': formatVal(sd.e_5_private_job_occupation),
        'E.6 Business': formatVal(sd.e_6_business_occupation || f.primary_business_occupation),
        'E.7 Profession': formatVal(sd.e_7_profession_occupation),
        'E.8 Other Occupation': formatVal(sd.e_8_other_occupation),
        'E.9 Annual Income Bracket': formatVal(sd.e_9_income_bracket),
        'E.10 Loan Status': formatVal(sd.e_10_loan_status !== undefined ? sd.e_10_loan_status : (f.loan_taken ? 'Yes' : 'No')),
        'E.11 Loan Agency': formatVal(sd.e_11_loan_agency || f.loan_source),

        // SECTION F
        'F.1 Cooking Fuel': formatVal(sd.f_1_fuel_type || f.cooking_fuel),
        'F.2 Gas Connection Source': formatVal(sd.f_2_gas_connection_type || f.gas_connection_source),
        'F.3 Ujjwala Refill (Last 6M)': formatVal(sd.f_3_ujwala_cylinder_refill),

        // SECTION G
        'G.1 Soil Testing Done': formatVal(sd.g_1_soil_testing_done),
        'G.2 Soil Health Card Received': formatVal(sd.g_2_soil_health_card_received || f.soil_health_card_status),

        // SECTION H
        'H.1 Delivery in Last 1 Yr': formatVal(sd.h_1_delivery_last_year),
        'H.2 Delivery Place': formatVal(sd.h_2_delivery_place),
        'H.3 Govt Vehicle Used': formatVal(sd.h_3_govt_vehicle_used),
        'H.4 Cash Assistance Received': formatVal(sd.h_4_cash_assistance_received),

        // SECTION I
        'I.1 MJPJAY Card Available': formatVal(sd.i_1_mjpjay_card_available),
        'I.2 Treatment Under MJPJAY': formatVal(sd.i_2_treatment_taken_under_mjpjay),
        'I.3 Free Treatment Awareness': formatVal(sd.i_3_aware_free_treatment),
        'I.4 Network Hospital Awareness': formatVal(sd.i_4_aware_network_hospitals),

        // SECTION J
        'J.1 Ration Card Type': formatVal(sd.j_1_ration_card_type),
        'J.2 PMGKAY Grains Received': formatVal(sd.j_2_pmgkay_grains_received),

        // SECTION K
        'K.1 Household Water Source': formatVal(sd.k_1_household_water_source),
        'K.2 Regular Water Supply': formatVal(sd.k_2_regular_water_supply),

        // SECTION L
        'L.1 Toilet Constructed': formatVal(sd.l_1_toilet_constructed),
        'L.2 Toilet in Regular Use': formatVal(sd.l_2_toilet_in_regular_use),

        // SECTION M
        'M.1 Ladaki Bahin Applied': formatVal(sd.m_1_eligible_ladies_applied),
        'M.2 Installment Received': formatVal(sd.m_2_installment_received),

        // Notes
        'Family Specific Problems': formatVal(sd.family_specific_problems || f.family_specific_problems),
        'Overall Observations': formatVal(sd.overall_observations)
      };
    });

    const buffer = createFamilySurveyWorkbook({ summaryRows, detailRows });
    const filename = `RI_Family_Survey_P${panelInfo.panel_number || 'Sheet'}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading family survey excel:', err);
    res.status(500).json({ message: 'Failed to download family survey excel', error: err.message });
  }
};

const downloadCommunityProjectsExcel = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { createCommunityProjectWorkbook } = require('../utils/riExcelExport');

    const panelRes = await pool.query(`
      SELECT rp.panel_number, rp.name as panel_name, rb.name as batch_name, v.name as village_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);
    const panelInfo = panelRes.rows[0] || {};

    const projRes = await pool.query(`
      SELECT 
        u.name as student_name,
        u.prn,
        p.*
      FROM ri_community_projects p
      JOIN users u ON p.student_id = u.id
      WHERE p.ri_batch_id = $1 AND p.ri_panel_id = $2
      ORDER BY u.name ASC
    `, [batchId, panelId]);

    const rows = projRes.rows.map((p, idx) => ({
      'Sr. No.': idx + 1,
      'PRN': String(p.prn || ''),
      'Student Name': p.student_name,
      'Project Title': p.project_title,
      'Pillar': p.pillar_type,
      'Village Location': p.location_in_village || panelInfo.village_name || '',
      'Activity Date': p.activity_date ? String(p.activity_date).split('T')[0] : '-',
      'Hours Spent': p.hours_spent,
      'Beneficiaries': p.beneficiary_description || '-',
      'Work Done': p.team_role_and_work_done || '-',
      'Impact & Outcome': p.impact_and_outcome || '-',
      'Status': p.status
    }));

    const buffer = createCommunityProjectWorkbook({ rows });
    const filename = `RI_Community_Projects_P${panelInfo.panel_number || 'Sheet'}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading community projects excel:', err);
    res.status(500).json({ message: 'Failed to download community projects excel', error: err.message });
  }
};

const downloadInstitutionalVisitsExcel = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { createInstitutionalVisitWorkbook } = require('../utils/riExcelExport');

    const panelRes = await pool.query(`
      SELECT rp.panel_number, rp.name as panel_name, rb.name as batch_name, v.name as village_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);
    const panelInfo = panelRes.rows[0] || {};

    const instRes = await pool.query(`
      SELECT 
        u.name as student_name,
        u.prn,
        iv.*
      FROM ri_institutional_visits iv
      JOIN users u ON iv.student_id = u.id
      WHERE iv.ri_batch_id = $1 AND iv.ri_panel_id = $2
      ORDER BY u.name ASC, iv.id ASC
    `, [batchId, panelId]);

    const rows = instRes.rows.map((v, idx) => ({
      'Sr. No.': idx + 1,
      'PRN': String(v.prn || ''),
      'Student Name': v.student_name,
      'Institution Type': v.institution_type,
      'Institution Name': v.institution_name,
      'Visit Date': v.visit_date ? String(v.visit_date).split('T')[0] : '-',
      'Official Contact': v.official_contact_person || '-',
      'Building Condition': v.infrastructure_condition || '-',
      'Drinking Water': v.drinking_water_available ? 'Yes' : 'No',
      'Toilet Available': v.toilet_available ? 'Yes' : 'No',
      'Key Observations': v.key_observations || '-',
      'Challenges Identified': v.challenges_identified || '-'
    }));

    const buffer = createInstitutionalVisitWorkbook({ rows });
    const filename = `RI_Institutional_Visits_P${panelInfo.panel_number || 'Sheet'}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading institutional visits excel:', err);
    res.status(500).json({ message: 'Failed to download institutional visits excel', error: err.message });
  }
};

const downloadOverallAssessmentExcel = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const { batchId, panelId } = scope;
    const { createOverallAssessmentWorkbook } = require('../utils/riExcelExport');

    const panelRes = await pool.query(`
      SELECT rp.panel_number, rp.name as panel_name, rb.name as batch_name, v.name as village_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [panelId, batchId]);
    const panelInfo = panelRes.rows[0] || {};

    const evalRes = await pool.query(`
      SELECT 
        u.name as student_name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number, '') as ri_id,
        u.department,
        sch.status as school_status,
        inst.status as inst_status,
        fam.status as fam_status,
        comm.status as comm_status,
        e.attendance_marks,
        e.institutional_visit_marks,
        e.family_survey_marks,
        e.community_project_marks,
        e.problem_solution_marks,
        e.team_collaboration_marks,
        e.total_marks,
        e.overall_grade,
        e.evaluation_status
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_attendance sch ON sch.student_id = u.id AND sch.ri_batch_id = $1 AND sch.ri_panel_id = $2 AND sch.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance inst ON inst.student_id = u.id AND inst.ri_batch_id = $1 AND inst.ri_panel_id = $2 AND inst.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance fam ON fam.student_id = u.id AND fam.ri_batch_id = $1 AND fam.ri_panel_id = $2 AND fam.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance comm ON comm.student_id = u.id AND comm.ri_batch_id = $1 AND comm.ri_panel_id = $2 AND comm.activity = 'COMMUNITY_PROJECT'
      LEFT JOIN ri_evaluations e ON e.student_id = u.id AND e.ri_batch_id = $1
      WHERE rbs.ri_batch_id = $1 AND rbs.ri_panel_id = $2
      ORDER BY u.roll_number ASC, u.name ASC
    `, [batchId, panelId]);

    const rows = evalRes.rows.map((s, idx) => {
      const tot = Number(s.total_marks || 0);
      const isPass = tot >= 40;
      return {
        'Sr. No.': idx + 1,
        'PRN': String(s.prn || ''),
        'Student Name': s.student_name,
        'Roll / RI ID': s.ri_id,
        'Department': s.department || '',
        'Batch': panelInfo.batch_name || '',
        'Panel': `P${panelInfo.panel_number}: ${panelInfo.panel_name}`,
        'Village': panelInfo.village_name || 'Not Allocated',
        'School Activity Att': s.school_status || 'Absent',
        'Institutional Visit Att': s.inst_status || 'Absent',
        'Family Visit Att': s.fam_status || 'Absent',
        'Community Project Att': s.comm_status || 'Absent',
        'Attendance Marks (15%)': Number(s.attendance_marks || 0).toFixed(2),
        'Institutional Visits (10%)': Number(s.institutional_visit_marks || 0).toFixed(2),
        'Family Visit (10%)': Number(s.family_survey_marks || 0).toFixed(2),
        'Community Projects (10%)': Number(s.community_project_marks || 0).toFixed(2),
        'Problem Statement & SDGs (15%)': Number(s.problem_statement_marks || 0).toFixed(2),
        'Proposed Smart Solution (40%)': Number(s.smart_solution_marks || s.problem_solution_marks || 0).toFixed(2),
        'Total Marks (100)': tot.toFixed(2),
        'Overall Grade': s.overall_grade || 'Pending',
        'Result': tot > 0 ? (isPass ? 'PASS' : 'FAIL') : 'Pending',
        'Credit Recommendation': tot >= 40 ? 'Recommended for 1 Credit Point' : 'Not Recommended',
        'Evaluation Status': s.evaluation_status || 'Pending'
      };
    });

    const buffer = createOverallAssessmentWorkbook({ rows });
    const filename = `RI_Overall_Assessment_P${panelInfo.panel_number || 'Sheet'}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading overall assessment excel:', err);
    res.status(500).json({ message: 'Failed to download overall assessment excel', error: err.message });
  }
};

// ─── 12. Get RI Faculty Undertaking Status ──────────────────────────────────
const getFacultyUndertaking = async (req, res) => {
  try {
    const facultyUserId = req.user?.id;
    const userEmail = req.userEmail;

    // Check users table first
    const userRes = await pool.query(
      `SELECT id, name, email, department, ri_undertaking_submitted, ri_undertaking_signed_name, ri_undertaking_signed_date, ri_tshirt_size
       FROM users WHERE id = $1 OR LOWER(email) = $2 LIMIT 1`,
      [facultyUserId || -1, userEmail]
    );

    // Also check ri_faculty_undertakings for full record details
    const underRes = await pool.query(
      `SELECT * FROM ri_faculty_undertakings 
       WHERE faculty_id = $1 OR faculty_id IN (SELECT id FROM users WHERE LOWER(email) = $2)
       ORDER BY created_at DESC LIMIT 1`,
      [facultyUserId || -1, userEmail]
    );

    const user = userRes.rows[0] || {};
    const underRecord = underRes.rows[0] || null;
    const isSubmitted = Boolean(user.ri_undertaking_submitted || underRecord);

    res.json({
      submitted: isSubmitted,
      undertaking: isSubmitted ? {
        ...(underRecord || {}),
        signed_name: underRecord?.signed_name || user.ri_undertaking_signed_name || user.name,
        signed_date: underRecord?.signed_date || user.ri_undertaking_signed_date,
        tshirt_size: underRecord?.tshirt_size || user.ri_tshirt_size,
        photo_video_consent: underRecord?.photo_video_consent ?? true,
        data_consent: underRecord?.data_consent ?? true,
        rules_consent: underRecord?.rules_consent ?? true,
        dos_donts_consent: underRecord?.dos_donts_consent ?? true,
        submitted_at: underRecord?.created_at,
        status: 'Submitted',
        submitted: true
      } : null
    });
  } catch (err) {
    console.error('Error fetching RI faculty undertaking:', err);
    res.status(500).json({ message: 'Failed to fetch undertaking details', error: err.message });
  }
};

// ─── 13. Submit RI Faculty Undertaking ──────────────────────────────────────
const submitFacultyUndertaking = async (req, res) => {
  try {
    const facultyUserId = req.user?.id;
    const userEmail = req.userEmail;
    const {
      signedName,
      signedDate,
      tshirtSize,
      photoVideoConsent,
      dataConsent,
      rulesConsent,
      dosDontsConsent
    } = req.body;

    if (!signedName || !signedName.trim()) {
      return res.status(400).json({ message: 'Digital signature (full name) is mandatory.' });
    }

    const sDate = signedDate || new Date().toISOString().split('T')[0];
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';

    // Get user id if not in token
    let uId = facultyUserId;
    if (!uId && userEmail) {
      const uRes = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [userEmail]);
      if (uRes.rowCount > 0) uId = uRes.rows[0].id;
    }

    // Insert into ri_faculty_undertakings audit table
    const insRes = await pool.query(`
      INSERT INTO ri_faculty_undertakings (
        faculty_id, signed_name, signed_date, tshirt_size,
        photo_video_consent, data_consent, rules_consent, dos_donts_consent, ip_address, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (faculty_id) DO UPDATE SET
        signed_name = EXCLUDED.signed_name,
        signed_date = EXCLUDED.signed_date,
        tshirt_size = EXCLUDED.tshirt_size,
        photo_video_consent = EXCLUDED.photo_video_consent,
        data_consent = EXCLUDED.data_consent,
        rules_consent = EXCLUDED.rules_consent,
        dos_donts_consent = EXCLUDED.dos_donts_consent,
        ip_address = EXCLUDED.ip_address,
        updated_at = NOW()
      RETURNING *
    `, [
      uId,
      signedName.trim(),
      sDate,
      tshirtSize,
      photoVideoConsent !== false,
      dataConsent !== false,
      rulesConsent !== false,
      dosDontsConsent !== false,
      clientIp
    ]);

    // Update users table isolated RI fields (NEVER touch LTC fields!)
    if (uId) {
      await pool.query(`
        UPDATE users SET
          ri_undertaking_submitted = true,
          ri_undertaking_signed_name = $1,
          ri_undertaking_signed_date = $2,
          ri_tshirt_size = $3
        WHERE id = $4
      `, [signedName.trim(), sDate, tshirtSize, uId]);
    }

    res.json({
      success: true,
      message: 'Rural Immersion Faculty Undertaking submitted successfully.',
      submitted: true,
      undertaking: {
        ...insRes.rows[0],
        submitted: true
      }
    });
  } catch (err) {
    console.error('Error submitting RI faculty undertaking:', err);
    res.status(500).json({ message: 'Failed to submit RI faculty undertaking', error: err.message });
  }
};

/**
 * 13. Get Faculty Allocated Village Details & Nearby Emergency Services
 * STRICT ISOLATION: Guarantees faculty can only see the village assigned to their assigned panel.
 */
const getFacultyVillageDetails = async (req, res) => {
  try {
    const scope = resolveFacultyScope(req, res, req.query.batch_id, req.query.panel_id);
    if (!scope.isValid) return;

    const villageRes = await pool.query(`
      SELECT 
        rp.id as panel_id,
        rp.panel_number,
        rp.name as panel_name,
        rp.ri_village_id,
        v.id as village_id,
        v.name as village_name,
        v.location as village_location,
        v.address as village_address,
        v.detailed_address as village_detailed_address,
        v.school_name as village_school_name,
        v.principal_mobile as village_principal_mobile,
        v.spoc_name as village_spoc_name,
        v.spoc_mobile as village_spoc_mobile,
        v.district as village_district,
        v.panchayat as village_panchayat,
        v.taluka as village_taluka,
        v.sarpanch_name,
        v.sarpanch_mobile,
        v.emergency_contact as village_emergency_contact,
        COALESCE(v.google_maps_link, rp.google_maps_link) as google_maps_link,
        v.remark as village_remark,
        v.notes as village_notes
      FROM ri_panels rp
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.id = $1 AND rp.ri_batch_id = $2
    `, [scope.panelId, scope.batchId]);

    if (villageRes.rowCount === 0 || !villageRes.rows[0].ri_village_id) {
      return res.status(404).json({ message: 'No allocated village assigned for this panel yet.' });
    }

    const row = villageRes.rows[0];
    const { services, village, cached } = await getOrFetchVillageServices(pool, row.ri_village_id);

    res.json({
      success: true,
      village: village || {
        id: row.village_id,
        name: row.village_name,
        location: row.village_location,
        address: row.village_address,
        detailed_address: row.village_detailed_address,
        school_name: row.village_school_name,
        principal_mobile: row.village_principal_mobile,
        spoc_name: row.village_spoc_name,
        spoc_mobile: row.village_spoc_mobile,
        district: row.village_district,
        panchayat: row.village_panchayat,
        taluka: row.village_taluka,
        sarpanch_name: row.sarpanch_name,
        sarpanch_mobile: row.sarpanch_mobile,
        emergency_contact: row.village_emergency_contact,
        google_maps_link: row.google_maps_link,
        remark: row.village_remark,
        notes: row.village_notes
      },
      services: services || [],
      cached: Boolean(cached)
    });
  } catch (err) {
    console.error('Error fetching faculty village details & services:', err);
    res.status(500).json({ message: 'Failed to load village emergency services', error: err.message });
  }
};

// ─── 14. Faculty Panel Uploads (Max 5 Photos + Gram Panchayat Certificate) ────
const getPanelMedia = async (req, res) => {
  try {
    const { batch_id, panel_id } = req.query;
    const scope = resolveFacultyScope(req, res, batch_id, panel_id);
    if (!scope.isValid) return;

    const mediaRes = await pool.query(`
      SELECT id, ri_batch_id, ri_panel_id, uploaded_by_id, uploaded_by_name,
             file_url, file_name, mime_type, file_size, caption, COALESCE(category, 'photo') AS category, created_at
      FROM ri_panel_media
      WHERE ri_batch_id = $1 AND ri_panel_id = $2
      ORDER BY created_at DESC
    `, [scope.batchId, scope.panelId]);

    const photos = mediaRes.rows.filter(r => (r.category === 'photo' || !r.category));
    const certificate = mediaRes.rows.find(r => r.category === 'gram_panchayat_certificate') || null;
    const stakeholderFeedback = mediaRes.rows.filter(r => r.category === 'stakeholder_feedback' || r.category === 'stakeholder_feedback_video');

    res.json({
      success: true,
      batch_id: scope.batchId,
      panel_id: scope.panelId,
      count: photos.length,
      photos_count: photos.length,
      max_allowed: 5,
      max_photos: 5,
      media: photos,
      photos,
      certificate,
      stakeholder_feedback: stakeholderFeedback,
      stakeholder_feedback_video: stakeholderFeedback[0] || null,
      all_uploads: mediaRes.rows
    });
  } catch (err) {
    console.error('Error fetching panel uploads:', err);
    res.status(500).json({ message: 'Failed to fetch panel uploads', error: err.message });
  }
};

// Helper to extract file buffer from memoryStorage or disk path with test-mock support
function extractFacultyUploadBuffer(file) {
  if (file?.buffer && Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
    return file.buffer;
  }
  if (file?.path && fs.existsSync(file.path)) {
    try {
      return fs.readFileSync(file.path);
    } catch {
      /* ignore */
    }
  }
  return null;
}

const uploadPanelPhoto = async (req, res) => {
  try {
    const { batch_id, panel_id, caption } = req.body;
    const scope = resolveFacultyScope(req, res, batch_id, panel_id);
    if (!scope.isValid) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return;
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image file to upload.' });
    }

    const fileBuffer = extractFacultyUploadBuffer(req.file);
    if (!fileBuffer) {
      return res.status(400).json({ message: 'Invalid or empty file payload.' });
    }

    // Check current count of photos for this panel (only category 'photo' or null)
    const countRes = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM ri_panel_media
      WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND (category = 'photo' OR category IS NULL)
    `, [scope.batchId, scope.panelId]);

    const currentCount = countRes.rows[0]?.total || 0;
    if (currentCount >= 5) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(400).json({
        message: 'Maximum limit of 5 visit pictures reached for this panel. Please delete an existing picture before uploading a new one.'
      });
    }

    // Upload new field visit photo directly to S3 under ri_faculty_uploads/photos/
    let storageResult;
    try {
      storageResult = await riStorageService.uploadFacultyFile({
        fileBuffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'image/jpeg',
        category: 'photo',
        batchId: scope.batchId,
        panelId: scope.panelId
      });
    } catch (storageErr) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      if (storageErr.code === 'INVALID_FILE_CONTENT') {
        return res.status(400).json({ message: storageErr.message });
      }
      console.error('Error uploading photo to S3:', storageErr);
      return res.status(502).json({ message: 'Failed to upload photo to cloud storage', error: storageErr.message });
    } finally {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
    }

    const uploaderName = (req.facultyAssignments && req.facultyAssignments[0]?.faculty_name) || req.user?.name || req.userEmail || 'Faculty Mentor';
    const fileUrl = storageResult.url;

    const insertRes = await pool.query(`
      INSERT INTO ri_panel_media (
        ri_batch_id, ri_panel_id, uploaded_by_id, uploaded_by_name,
        file_url, file_name, mime_type, file_size, caption, category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'photo')
      RETURNING *
    `, [
      scope.batchId,
      scope.panelId,
      req.user?.id || null,
      uploaderName,
      fileUrl,
      req.file.originalname,
      req.file.mimetype || 'image/jpeg',
      fileBuffer.length,
      caption ? caption.trim() : null
    ]);

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: req.user?.id,
      userEmail: req.userEmail || req.user?.email,
      userName: uploaderName,
      userRole: req.user?.role || 'faculty',
      action: 'UPLOAD_PANEL_PHOTO',
      batchId: scope.batchId,
      panelId: scope.panelId,
      details: { file_name: req.file.originalname, file_url: fileUrl, caption: caption ? caption.trim() : null }
    });

    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully.',
      media: insertRes.rows[0],
      current_count: currentCount + 1,
      max_allowed: 5
    });
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('Error uploading panel photo:', err);
    res.status(500).json({ message: 'Failed to upload photo', error: err.message });
  }
};

const uploadGramPanchayatCertificate = async (req, res) => {
  try {
    const { batch_id, panel_id, caption } = req.body;
    const scope = resolveFacultyScope(req, res, batch_id, panel_id);
    if (!scope.isValid) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return;
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please select a document or image file to upload.' });
    }

    const fileBuffer = extractFacultyUploadBuffer(req.file);
    if (!fileBuffer) {
      return res.status(400).json({ message: 'Invalid or empty file payload.' });
    }

    // REQUIREMENT 8: Preserve existing certificate until the new upload has successfully completed
    // and the database reference has been safely updated. If replacement fails, old certificate must remain accessible.
    const existingRes = await pool.query(`
      SELECT * FROM ri_panel_media
      WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND category = 'gram_panchayat_certificate'
    `, [scope.batchId, scope.panelId]);
    const oldCertificates = existingRes.rows;

    // Upload new certificate to S3 under ri_faculty_uploads/certificates/
    let storageResult;
    try {
      storageResult = await riStorageService.uploadFacultyFile({
        fileBuffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'application/pdf',
        category: 'gram_panchayat_certificate',
        batchId: scope.batchId,
        panelId: scope.panelId
      });
    } catch (uploadErr) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      if (uploadErr.code === 'INVALID_FILE_CONTENT') {
        return res.status(400).json({ message: uploadErr.message });
      }
      console.error('Error uploading Gram Panchayat Certificate to S3:', uploadErr);
      return res.status(502).json({
        message: 'Failed to upload Gram Panchayat Certificate to cloud storage. Previous certificate preserved.',
        error: uploadErr.message
      });
    } finally {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
    }

    const uploaderName = (req.facultyAssignments && req.facultyAssignments[0]?.faculty_name) || req.user?.name || req.userEmail || 'Faculty Mentor';
    const fileUrl = storageResult.url;

    let insertRes;
    try {
      insertRes = await pool.query(`
        INSERT INTO ri_panel_media (
          ri_batch_id, ri_panel_id, uploaded_by_id, uploaded_by_name,
          file_url, file_name, mime_type, file_size, caption, category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'gram_panchayat_certificate')
        RETURNING *
      `, [
        scope.batchId,
        scope.panelId,
        req.user?.id || null,
        uploaderName,
        fileUrl,
        req.file.originalname,
        req.file.mimetype || 'application/pdf',
        fileBuffer.length,
        caption ? caption.trim() : 'Gram Panchayat Certificate'
      ]);

      // Only delete old certificate DB references AFTER the new upload has successfully inserted
      if (oldCertificates.length > 0) {
        await pool.query(`
          DELETE FROM ri_panel_media
          WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND category = 'gram_panchayat_certificate' AND id != $3
        `, [scope.batchId, scope.panelId, insertRes.rows[0].id]);
      }
    } catch (dbErr) {
      console.error('Database update failed during certificate replacement:', dbErr);
      // Clean up newly uploaded S3 object since DB insert failed, preserving old certificate
      try {
        await riStorageService.deleteFacultyFile(storageResult.storageKey);
      } catch (_) {}
      return res.status(500).json({
        message: 'Failed to update certificate database record. Previous certificate preserved.',
        error: dbErr.message
      });
    }

    // Now safely clean up previous certificate storage using correct storage mechanisms
    for (const oldItem of oldCertificates) {
      try {
        if (riStorageService.isS3FacultyReference(oldItem.file_url)) {
          // Never pass an S3 object key to fs.unlinkSync()
          await riStorageService.deleteFacultyFile(oldItem.file_url);
        } else if (riStorageService.isLegacyLocalFacultyReference(oldItem.file_url)) {
          // Never pass a legacy local path to the S3 deletion service
          const fn = path.basename(oldItem.file_url);
          const fp = path.join(__dirname, '../uploads/ri_media', fn);
          if (fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch {}
          }
        }
      } catch (cleanErr) {
        console.warn('Non-fatal: failed to clean up replaced certificate file:', cleanErr.message);
      }
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: req.user?.id,
      userEmail: req.userEmail || req.user?.email,
      userName: uploaderName,
      userRole: req.user?.role || 'faculty',
      action: 'UPLOAD_GRAM_PANCHAYAT_CERTIFICATE',
      batchId: scope.batchId,
      panelId: scope.panelId,
      details: { file_name: req.file.originalname, file_url: fileUrl, caption: caption ? caption.trim() : 'Gram Panchayat Certificate' }
    });

    res.status(201).json({
      success: true,
      message: 'Gram Panchayat Certificate uploaded successfully.',
      certificate: insertRes.rows[0]
    });
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('Error uploading Gram Panchayat Certificate:', err);
    res.status(500).json({ message: 'Failed to upload Gram Panchayat Certificate', error: err.message });
  }
};

const uploadStakeholderFeedbackVideo = async (req, res) => {
  try {
    const { batch_id, panel_id, caption } = req.body;
    const scope = resolveFacultyScope(req, res, batch_id, panel_id);
    if (!scope.isValid) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return;
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please select a video file of stakeholder feedback to upload.' });
    }

    const fileBuffer = extractFacultyUploadBuffer(req.file);
    if (!fileBuffer) {
      return res.status(400).json({ message: 'Invalid or empty file payload.' });
    }

    // Verify it is a valid video file
    const ext = path.extname(req.file.originalname).toLowerCase();
    const videoExts = ['.mp4', '.mov', '.webm', '.m4v', '.3gp', '.avi', '.mkv'];
    const isVideoMime = req.file.mimetype && req.file.mimetype.startsWith('video/');
    if (!videoExts.includes(ext) && !isVideoMime) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(400).json({
        message: 'Only video files (MP4, MOV, WEBM, 3GP, MKV) are allowed for stakeholder feedback.'
      });
    }

    // Enforce 10 MB maximum limit for stakeholder feedback video
    const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
    const actualSize = fileBuffer.length || req.file.size;
    if (actualSize > MAX_VIDEO_BYTES) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(400).json({
        message: 'Stakeholder feedback video exceeds 10MB limit. Please compress or shorten the video before uploading.'
      });
    }

    // Check count: allow up to 3 stakeholder feedback videos per panel
    const countRes = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM ri_panel_media
      WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND (category = 'stakeholder_feedback' OR category = 'stakeholder_feedback_video')
    `, [scope.batchId, scope.panelId]);

    const currentCount = countRes.rows[0]?.total || 0;
    if (currentCount >= 3) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(400).json({
        message: 'Maximum limit of 3 stakeholder feedback videos reached for this panel. Please delete an existing video before uploading a new one.'
      });
    }

    // Upload new stakeholder feedback video to S3 under ri_faculty_uploads/feedback_videos/
    let storageResult;
    try {
      storageResult = await riStorageService.uploadFacultyFile({
        fileBuffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'video/mp4',
        category: 'stakeholder_feedback',
        batchId: scope.batchId,
        panelId: scope.panelId
      });
    } catch (uploadErr) {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      if (uploadErr.code === 'INVALID_FILE_CONTENT') {
        return res.status(400).json({ message: uploadErr.message });
      }
      console.error('Error uploading stakeholder feedback video to S3:', uploadErr);
      return res.status(502).json({ message: 'Failed to upload stakeholder feedback video to cloud storage', error: uploadErr.message });
    } finally {
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
    }

    const uploaderName = (req.facultyAssignments && req.facultyAssignments[0]?.faculty_name) || req.user?.name || req.userEmail || 'Faculty Mentor';
    const fileUrl = storageResult.url;

    const insertRes = await pool.query(`
      INSERT INTO ri_panel_media (
        ri_batch_id, ri_panel_id, uploaded_by_id, uploaded_by_name,
        file_url, file_name, mime_type, file_size, caption, category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'stakeholder_feedback')
      RETURNING *
    `, [
      scope.batchId,
      scope.panelId,
      req.user?.id || null,
      uploaderName,
      fileUrl,
      req.file.originalname,
      req.file.mimetype || 'video/mp4',
      fileBuffer.length,
      caption ? caption.trim() : 'Stakeholder Feedback'
    ]);

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: req.user?.id,
      userEmail: req.userEmail || req.user?.email,
      userName: uploaderName,
      userRole: req.user?.role || 'faculty',
      action: 'UPLOAD_STAKEHOLDER_VIDEO',
      batchId: scope.batchId,
      panelId: scope.panelId,
      details: { file_name: req.file.originalname, file_url: fileUrl, caption: caption ? caption.trim() : 'Stakeholder Feedback' }
    });

    res.status(201).json({
      success: true,
      message: 'Stakeholder feedback video uploaded successfully.',
      media: insertRes.rows[0],
      current_count: currentCount + 1,
      max_allowed: 3
    });
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('Error uploading stakeholder feedback video:', err);
    res.status(500).json({ message: 'Failed to upload stakeholder feedback video', error: err.message });
  }
};

const uploadPanelMedia = async (req, res) => {
  const category = (req.body.category || 'photo').toLowerCase();
  if (category === 'gram_panchayat_certificate' || category === 'certificate') {
    return uploadGramPanchayatCertificate(req, res);
  }
  if (category === 'stakeholder_feedback' || category === 'stakeholder_feedback_video' || category === 'feedback_video' || category === 'video') {
    return uploadStakeholderFeedbackVideo(req, res);
  }
  return uploadPanelPhoto(req, res);
};

const deletePanelMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const mediaId = parseInt(id, 10);
    if (isNaN(mediaId)) {
      return res.status(400).json({ message: 'Invalid media ID.' });
    }

    const mediaRes = await pool.query(`
      SELECT * FROM ri_panel_media WHERE id = $1
    `, [mediaId]);

    if (mediaRes.rowCount === 0) {
      return res.status(404).json({ message: 'Media not found.' });
    }

    const item = mediaRes.rows[0];
    const scope = resolveFacultyScope(req, res, item.ri_batch_id, item.ri_panel_id);
    if (!scope.isValid) return;

    // Delete record from DB
    await pool.query(`DELETE FROM ri_panel_media WHERE id = $1`, [mediaId]);

    // Backward-compatible physical file deletion:
    // S3 objects -> S3 deletion service (NEVER pass to fs.unlinkSync)
    // Legacy local EC2 files -> fs.unlinkSync (NEVER pass to S3 deletion service)
    if (item.file_url) {
      if (riStorageService.isS3FacultyReference(item.file_url)) {
        await riStorageService.deleteFacultyFile(item.file_url);
      } else if (riStorageService.isLegacyLocalFacultyReference(item.file_url)) {
        const filename = path.basename(item.file_url);
        const filePath = path.join(__dirname, '../uploads/ri_media', filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
    }

    let successMsg = 'Photo deleted successfully.';
    if (item.category === 'gram_panchayat_certificate') {
      successMsg = 'Certificate deleted successfully.';
    } else if (item.category === 'stakeholder_feedback' || item.category === 'stakeholder_feedback_video') {
      successMsg = 'Stakeholder feedback video deleted successfully.';
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: req.user?.id,
      userEmail: req.userEmail || req.user?.email,
      userName: req.user?.name || 'Faculty Mentor',
      userRole: req.user?.role || 'faculty',
      action: 'DELETE_PANEL_MEDIA',
      batchId: item.ri_batch_id,
      panelId: item.ri_panel_id,
      recordId: mediaId,
      details: { category: item.category, file_name: item.file_name }
    });

    res.json({
      success: true,
      message: successMsg
    });
  } catch (err) {
    console.error('Error deleting panel media:', err);
    res.status(500).json({ message: 'Failed to delete upload', error: err.message });
  }
};

// ============================================================================
// SINGLE-USE FACULTY FILE ACCESS TICKETS: Nonce Tracking & Lifecycle
// ============================================================================
// In-memory store for consumed single-use faculty ticket nonces to enforce single-use access.
// Maps jti -> consumedTimestamp.
//
// DEPLOYMENT ARCHITECTURE NOTE & LIMITATIONS:
// In the current single-instance EC2 deployment, process-local in-memory tracking
// strictly prevents ticket replay and unauthorized reuse.
// LIMITATION: If the backend service is horizontally scaled across multiple cluster worker
// processes (e.g. PM2 cluster mode) or across multiple EC2 server instances behind a load balancer
// without sticky sessions, process-local memory is not shared between processes. In such a multi-node
// architecture, a shared distributed cache (e.g., Redis) or a database-backed nonce ledger would be
// required for centralized single-use coordination across instances.
const consumedFacultyTicketJtis = new Map();

// Periodically prune consumed ticket nonces older than 5 minutes (well beyond the 60s ticket expiration)
const facultyTicketCleanupInterval = setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [jti, ts] of consumedFacultyTicketJtis.entries()) {
    if (ts < cutoff) {
      consumedFacultyTicketJtis.delete(jti);
    }
  }
}, 60 * 1000);
if (facultyTicketCleanupInterval.unref) facultyTicketCleanupInterval.unref();

function _clearConsumedFacultyTicketsForTesting() {
  consumedFacultyTicketJtis.clear();
}

function normalizeFacultyKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  const s3Key = riStorageService.extractFacultyStorageKey(trimmed);
  if (s3Key) return s3Key;
  return trimmed.replace(/^\/+/, '');
}

/**
 * Serve faculty files (Backward-compatible retrieval for both legacy EC2 files and S3 objects)
 * - Existing references (/uploads/ri_media/...) served from local filesystem.
 * - New S3-backed references served via S3 storage service.
 * - Authenticated access strictly required via Bearer header or single-use ticket.
 */
const serveFacultyFile = async (req, res) => {
  try {
    const { key, ticket, download } = req.query;
    if (!key) {
      return res.status(400).json({ message: 'Missing file key parameter.' });
    }

    const decodedKey = decodeURIComponent(key).trim();
    if (decodedKey.includes('..') || decodedKey.includes('\\')) {
      return res.status(400).json({ message: 'Invalid file key path.' });
    }

    // 1. Authenticate access
    let isAuthorized = false;

    if (ticket) {
      let ticketPayload;
      try {
        ticketPayload = jwt.verify(ticket, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: 'Invalid or expired file access ticket.' });
      }

      if (!ticketPayload.ticket || !ticketPayload.jti) {
        return res.status(401).json({ message: 'Malformed file access ticket payload.' });
      }

      // Check object key binding (exact match after canonical key normalization)
      const canonicalTicketKey = normalizeFacultyKey(ticketPayload.key);
      const canonicalRequestKey = normalizeFacultyKey(decodedKey);

      if (!canonicalTicketKey || !canonicalRequestKey || canonicalTicketKey !== canonicalRequestKey) {
        return res.status(403).json({ message: 'File access ticket is not valid for this object.' });
      }

      // Replay prevention: each ticket can successfully authorize access only once
      if (consumedFacultyTicketJtis.has(ticketPayload.jti)) {
        return res.status(403).json({ message: 'File access ticket has already been used. Please request a new ticket.' });
      }

      // Consume the ticket immediately to block subsequent reuse
      consumedFacultyTicketJtis.set(ticketPayload.jti, Date.now());

      isAuthorized = true;
    } else {
      let token = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else if (req.query.token) {
        token = req.query.token;
      }

      if (token) {
        try {
          jwt.verify(token, process.env.JWT_SECRET);
          isAuthorized = true;
        } catch {
          return res.status(401).json({ message: 'Invalid or expired session token.' });
        }
      } else if (req.user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ message: 'Authentication required to access faculty file.' });
    }

    // 2. Deliver file based on storage mechanism
    // A. Legacy local EC2 file
    if (riStorageService.isLegacyLocalFacultyReference(decodedKey) || (!decodedKey.startsWith('ri_faculty_uploads/') && !decodedKey.startsWith('ri_student_uploads/'))) {
      const filename = path.basename(decodedKey);
      const localPath = path.join(__dirname, '../uploads/ri_media', filename);
      if (fs.existsSync(localPath)) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const isDownload = download === 'true';
        if (isDownload) {
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        return res.sendFile(localPath);
      }
      return res.status(404).json({ message: 'Legacy faculty file not found on local storage.' });
    }

    // B. New S3 object
    const cleanStorageKey = riStorageService.extractFacultyStorageKey(decodedKey) || decodedKey;
    try {
      const streamInfo = await riStorageService.getObjectStream(cleanStorageKey);
      res.setHeader('Content-Type', streamInfo.ContentType || 'application/octet-stream');
      if (streamInfo.ContentLength) res.setHeader('Content-Length', streamInfo.ContentLength);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      const filename = path.basename(cleanStorageKey);
      const isDownload = download === 'true';
      res.setHeader('Content-Disposition', isDownload ? `attachment; filename="${filename}"` : 'inline');
      return streamInfo.Body.pipe(res);
    } catch (s3Err) {
      if (s3Err.name === 'NoSuchKey' || s3Err.$metadata?.httpStatusCode === 404) {
        return res.status(404).json({ message: 'Requested file not found in cloud storage.' });
      }
      console.error('[serveFacultyFile S3 Error]:', s3Err.message);
      return res.status(502).json({ message: 'Error retrieving file from cloud storage.' });
    }
  } catch (err) {
    console.error('Error serving faculty file:', err);
    return res.status(500).json({ message: 'Internal server error serving faculty file.' });
  }
};

/**
 * Generate short-lived, single-use, object-bound file access ticket
 */
const createFacultyFileAccessTicket = async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ message: 'Missing file key parameter.' });
    }
    const decodedKey = decodeURIComponent(key).trim();
    if (decodedKey.includes('..') || decodedKey.includes('\\')) {
      return res.status(400).json({ message: 'Invalid file key path.' });
    }

    const jti = crypto.randomBytes(16).toString('hex');
    const ticket = jwt.sign(
      {
        ticket: true,
        jti,
        sub: req.user?.id,
        role: req.user?.role || 'faculty',
        key: decodedKey
      },
      process.env.JWT_SECRET,
      { expiresIn: '60s' }
    );

    return res.json({
      success: true,
      ticket,
      expiresIn: 60,
      viewUrl: `/api/ri/faculty/files/view?key=${encodeURIComponent(decodedKey)}&ticket=${ticket}`
    });
  } catch (err) {
    console.error('Error generating faculty file access ticket:', err);
    return res.status(500).json({ message: 'Internal error generating file access ticket.' });
  }
};

const downloadCertificateTemplate = async (req, res) => {
  try {
    const lang = String(req.params.lang || 'english').toLowerCase();
    const isMarathi = lang.includes('marathi') || lang.includes('mar');
    const primaryName = isMarathi ? 'cert-mar.docx' : 'cert-eng.docx';
    const fallbackName = isMarathi ? 'Certificate_Marathi.docx' : 'Certificate_English.docx';

    const possiblePaths = [
      path.join(__dirname, '../templates', primaryName),
      path.join(__dirname, '../templates', fallbackName),
      path.join(__dirname, '../uploads/templates', primaryName),
      path.join(__dirname, '../../frontend/public', primaryName),
      path.join(__dirname, '../../frontend/public/documents', primaryName),
      path.join(__dirname, '../../frontend', primaryName),
      path.join(__dirname, '../uploads/templates', fallbackName),
      path.join(__dirname, '../../frontend/public', fallbackName),
      path.join(__dirname, '../../frontend/public/documents', fallbackName),
      path.join(__dirname, '../../frontend', fallbackName)
    ];

    let targetPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        targetPath = p;
        break;
      }
    }

    if (!targetPath) {
      return res.status(404).json({ message: 'Gram Panchayat certificate template file not found.' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${primaryName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return res.sendFile(targetPath);
  } catch (err) {
    console.error('Error downloading certificate template:', err);
    res.status(500).json({ message: 'Failed to download certificate template', error: err.message });
  }
};

module.exports = {
  getFacultyProfile,
  getFacultyDashboard,
  getMyPanel,
  getPanelStudents,
  getActivitiesAndEvaluation,
  getImmersionSchedule,
  getPanelAttendance,
  markPanelAttendance,
  markAllActivitiesPresent,
  getPanelSubmissions,
  getStudentSubmissionDetail,
  saveStudentEvaluation,
  getPanelEvaluations,
  saveBulkEvaluations,
  downloadAttendanceExcel,
  downloadStudentFormsExcel,
  downloadEvaluationExcel,
  downloadFamilySurveysExcel,
  downloadCommunityProjectsExcel,
  downloadInstitutionalVisitsExcel,
  downloadOverallAssessmentExcel,
  getFacultyUndertaking,
  submitFacultyUndertaking,
  getFacultyVillageDetails,
  getPanelMedia,
  uploadPanelMedia,
  uploadPanelPhoto,
  uploadGramPanchayatCertificate,
  deletePanelMedia,
  downloadCertificateTemplate,
  uploadStakeholderFeedbackVideo,
  serveFacultyFile,
  createFacultyFileAccessTicket,
  _clearConsumedFacultyTicketsForTesting,
  checkPanelAttendanceLocked,
  checkStudentFormsStatus
};



