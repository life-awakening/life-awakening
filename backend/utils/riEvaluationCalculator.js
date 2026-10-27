/**
 * Official RI Evaluation Calculator — NEW 100-MARK SCHEME
 * 
 * 1. Attendance (15% Weightage — 15 Marks Max)
 *    Auto-calculated from 4 RI field activities:
 *    - 4/4 Present = 15.00 Marks
 *    - 3/4 Present = 11.25 Marks
 *    - 2/4 Present = 7.50 Marks
 *    - 1/4 Present = 3.75 Marks
 *    - 0/4 Present = 0.00 Marks
 * 
 * 2. Activities and Field Survey (30% Weightage — 30 Marks Max)
 *    - Institutional Visit (10 Marks)
 *    - Family Visit (10 Marks)
 *    - Community Project (10 Marks)
 *    Rating mapping:
 *    - Excellent = 10 Marks
 *    - Good = 8 Marks
 *    - Satisfactory = 6 Marks
 *    - Unsatisfactory / Needs Improvement = 3 Marks
 * 
 * 3. Problem Statement Identification, Degree Relevance & SDGs Alignment (15% Weightage — 15 Marks Max)
 *    - Simple direct score: 0–15 Marks
 * 
 * 4. Proposed Smart Solution for the Identified Problem Statements Through Report and Presentation (40% Weightage — 40 Marks Max)
 *    - Simple direct score: 0–40 Marks
 * 
 * Total: 15 + 30 + 15 + 40 = 100 Marks Max
 */

const RATING_MARKS = {
  'Excellent': 10,
  'Good': 8,
  'Satisfactory': 6,
  'Needs Improvement': 3,
  'Unsatisfactory': 3
};

/**
 * Convert activity status string into boolean present
 */
function isStatusPresent(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'present' || s === 'p';
}

/**
 * Compute official evaluation scores according to the 100-mark rubric
 * @param {Object} input
 * @param {Object} [config]
 */
function calculateRiEvaluation(input = {}, config = {}) {
  // 1. Attendance (15% weightage — 15 Marks Total)
  // 3.75 marks per present activity across all 4 mandatory activities:
  // - School Activity
  // - Institutional Visit
  // - Family Visit
  // - Community Project
  let presentActivitiesCount = 0;

  if (input.activities_present_count !== undefined && input.activities_present_count !== null && !isNaN(Number(input.activities_present_count))) {
    presentActivitiesCount = Math.min(4, Math.max(0, parseInt(input.activities_present_count, 10) || 0));
  } else {
    const schoolP = isStatusPresent(input.school_activity_status || input.school_status);
    const instP = isStatusPresent(input.institutional_visit_status || input.inst_status);
    const famP = isStatusPresent(input.family_survey_status || input.fam_status);
    const commP = isStatusPresent(input.community_project_status || input.comm_status);

    if (schoolP) presentActivitiesCount++;
    if (instP) presentActivitiesCount++;
    if (famP) presentActivitiesCount++;
    if (commP) presentActivitiesCount++;
  }

  // Exact step-wise mapping or formula: count * 3.75
  const ATTENDANCE_SCALE = {
    4: 15.00,
    3: 11.25,
    2: 7.50,
    1: 3.75,
    0: 0.00
  };

  let calculatedAttendanceMarks = ATTENDANCE_SCALE[presentActivitiesCount] ?? Number((presentActivitiesCount * 3.75).toFixed(2));
  calculatedAttendanceMarks = Math.min(15, Math.max(0, calculatedAttendanceMarks));

  // 2. Activities and Field Survey (30% weightage — 30 Marks Total)
  // Institutional Visit (10 Marks)
  const instRating = input.institutional_visit_rating || input.institutional_visits_rating || null;
  const instMarks = (input.institutional_visit_marks !== undefined && input.institutional_visit_marks !== null && !isNaN(Number(input.institutional_visit_marks)))
    ? Math.min(10, Math.max(0, Number(input.institutional_visit_marks)))
    : (RATING_MARKS[instRating] ?? 0);

  // Family Visit (10 Marks)
  const famRating = input.family_visit_rating || input.family_survey_rating || null;
  const rawFamMarks = input.family_visit_marks !== undefined ? input.family_visit_marks : input.family_survey_marks;
  const famMarks = (rawFamMarks !== undefined && rawFamMarks !== null && !isNaN(Number(rawFamMarks)))
    ? Math.min(10, Math.max(0, Number(rawFamMarks)))
    : (RATING_MARKS[famRating] ?? 0);

  // Community Project (10 Marks)
  const commRating = input.community_project_rating || input.community_projects_rating || null;
  const commMarks = (input.community_project_marks !== undefined && input.community_project_marks !== null && !isNaN(Number(input.community_project_marks)))
    ? Math.min(10, Math.max(0, Number(input.community_project_marks)))
    : (RATING_MARKS[commRating] ?? 0);

  const activitiesSurveyMarks = Number((instMarks + famMarks + commMarks).toFixed(2));

  // 3. Problem Statement Identification, Degree Relevance & SDGs Alignment (15% weightage — 15 Marks Total)
  const rawProbStatement = input.problem_statement_marks ?? input.problem_statement_score;
  let problemStatementMarks = 0;
  if (rawProbStatement !== undefined && rawProbStatement !== null && !isNaN(Number(rawProbStatement))) {
    problemStatementMarks = Math.min(15, Math.max(0, Number(rawProbStatement)));
  } else if (input.sdg_alignment_score !== undefined && !isNaN(Number(input.sdg_alignment_score))) {
    // Fallback if legacy field was passed
    problemStatementMarks = Math.min(15, Math.max(0, Number(input.sdg_alignment_score)));
  }
  problemStatementMarks = Number(problemStatementMarks.toFixed(2));

  // 4. Proposed Smart Solution for the Identified Problem Statements Through Report and Presentation (40% weightage — 40 Marks Total)
  const rawSmartSolution = input.smart_solution_marks ?? input.smart_solution_score;
  let smartSolutionMarks = 0;
  if (rawSmartSolution !== undefined && rawSmartSolution !== null && !isNaN(Number(rawSmartSolution))) {
    smartSolutionMarks = Math.min(40, Math.max(0, Number(rawSmartSolution)));
  } else if (input.problem_solution_marks !== undefined && !isNaN(Number(input.problem_solution_marks))) {
    // Fallback if legacy problem_solution_marks was passed
    smartSolutionMarks = Math.min(40, Math.max(0, Number(input.problem_solution_marks)));
  }
  smartSolutionMarks = Number(smartSolutionMarks.toFixed(2));

  // Total Marks (Sum of the 4 sections, out of 100)
  const totalMarks = Math.min(100, Number((
    calculatedAttendanceMarks +
    instMarks +
    famMarks +
    commMarks +
    problemStatementMarks +
    smartSolutionMarks
  ).toFixed(2)));

  // Letter Grade
  let grade = 'Pending';
  if (totalMarks >= 90) grade = 'O';
  else if (totalMarks >= 80) grade = 'A+';
  else if (totalMarks >= 70) grade = 'A';
  else if (totalMarks >= 60) grade = 'B+';
  else if (totalMarks >= 50) grade = 'B';
  else if (totalMarks >= 40) grade = 'C';
  else if (totalMarks > 0 || input.evaluation_status === 'Completed' || input.status === 'Completed') grade = 'F';

  return {
    attendance_marks: calculatedAttendanceMarks,
    activities_present_count: presentActivitiesCount,
    institutional_visit_rating: instRating,
    institutional_visit_marks: instMarks,
    family_survey_rating: famRating,
    family_survey_marks: famMarks,
    community_project_rating: commRating,
    community_project_marks: commMarks,
    activities_survey_marks: activitiesSurveyMarks,
    activities_marks: activitiesSurveyMarks,
    problem_statement_marks: problemStatementMarks,
    smart_solution_marks: smartSolutionMarks,
    // Aliases / Compatibility fields
    problem_solution_marks: smartSolutionMarks,
    total_marks: totalMarks,
    overall_grade: grade
  };
}

/**
 * Calculate visit deadlines and lock status
 * - Attendance locks 7 days after visit end date
 * - Evaluation locks 15 days after visit end date
 */
function calculateRiVisitDeadlines(batchStartDate, batchEndDate) {
  const hasEndDate = Boolean(batchEndDate);
  const refDateVal = batchEndDate || batchStartDate;
  if (!refDateVal) {
    return {
      has_visit_dates: false,
      visit_end_date: null,
      ri_visit_end_date: null,
      attendance_deadline: null,
      evaluation_deadline: null,
      is_attendance_locked: false,
      is_evaluation_locked: false,
      days_left_attendance: 999,
      days_left_evaluation: 999,
      days_overdue_attendance: 0,
      days_overdue_evaluation: 0
    };
  }

  let y, m, d, dateStr;
  if (refDateVal instanceof Date) {
    y = refDateVal.getFullYear();
    m = refDateVal.getMonth();
    d = refDateVal.getDate();
    dateStr = refDateVal.toISOString().split('T')[0];
  } else {
    dateStr = String(refDateVal).split('T')[0];
    const parts = dateStr.split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  }

  // If actual batch end date is provided:
  //   Attendance locks 7 days after batch end date
  //   Evaluation locks 15 days after batch end date
  // If only batch start date is provided (2-day RI program):
  //   Day 1: d, Day 2: d + 1 (visit end), Day 3 starts countdown (d + 2)
  //   Attendance locks d + 9 (7 days from Day 3)
  //   Evaluation locks d + 17 (15 days from Day 3)
  const attDaysToAdd = hasEndDate ? 7 : 9;
  const evalDaysToAdd = hasEndDate ? 15 : 17;

  const attDeadline = new Date(y, m, d + attDaysToAdd, 23, 59, 59, 999);
  const evalDeadline = new Date(y, m, d + evalDaysToAdd, 23, 59, 59, 999);

  const now = new Date();
  const isAttendanceLocked = now.getTime() > attDeadline.getTime();
  const isEvaluationLocked = now.getTime() > evalDeadline.getTime();

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeftAttendance = isAttendanceLocked ? 0 : Math.ceil((attDeadline.getTime() - now.getTime()) / msPerDay);
  const daysLeftEvaluation = isEvaluationLocked ? 0 : Math.ceil((evalDeadline.getTime() - now.getTime()) / msPerDay);
  const daysOverdueAttendance = isAttendanceLocked ? Math.ceil((now.getTime() - attDeadline.getTime()) / msPerDay) : 0;
  const daysOverdueEvaluation = isEvaluationLocked ? Math.ceil((now.getTime() - evalDeadline.getTime()) / msPerDay) : 0;

  return {
    has_visit_dates: true,
    visit_end_date: dateStr,
    ri_visit_end_date: dateStr,
    attendance_deadline: attDeadline.toISOString(),
    evaluation_deadline: evalDeadline.toISOString(),
    is_attendance_locked: isAttendanceLocked,
    is_evaluation_locked: isEvaluationLocked,
    days_left_attendance: daysLeftAttendance,
    days_left_evaluation: daysLeftEvaluation,
    days_overdue_attendance: daysOverdueAttendance,
    days_overdue_evaluation: daysOverdueEvaluation
  };
}

/**
 * Authoritative effective attendance lock resolution:
 * 1. Active temporary unlock by Superadmin (now <= unlocked_until) -> UNLOCKED (TEMP_UNLOCKED)
 * 2. Expired temporary unlock (now > unlocked_until) -> reverts to LOCKED if deadline passed or manual lock
 * 3. Manual lock by Faculty/Admin (is_locked === true) -> LOCKED
 * 4. Automatic deadline lock (now > 7 days after batch end date) -> LOCKED
 * 5. Default -> UNLOCKED
 */
function computeEffectiveAttendanceLock({
  batchStartDate,
  batchEndDate,
  lockRow,
  now = new Date()
}) {
  const deadlines = calculateRiVisitDeadlines(batchStartDate, batchEndDate);
  const isAutoDeadlineLocked = deadlines.is_attendance_locked === true;

  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();

  let isTempUnlocked = false;
  let tempUnlockExpiry = null;
  let tempUnlockExpired = false;

  if (lockRow && lockRow.unlocked_until) {
    const expiryDate = new Date(lockRow.unlocked_until);
    if (!isNaN(expiryDate.getTime())) {
      tempUnlockExpiry = expiryDate.toISOString();
      if (nowMs <= expiryDate.getTime()) {
        isTempUnlocked = true;
      } else {
        tempUnlockExpired = true;
      }
    }
  }

  // 1. If currently within active temporary unlock period -> UNLOCKED
  if (isTempUnlocked) {
    const expiryFormatted = new Date(tempUnlockExpiry).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return {
      is_locked: false,
      effective_status: 'TEMP_UNLOCKED',
      is_temp_unlocked: true,
      unlocked_until: tempUnlockExpiry,
      lock_reason: lockRow.lock_reason || `Temporarily unlocked by Superadmin until ${expiryFormatted}`,
      locked_at: null,
      locked_by_email: null,
      locked_by_name: null,
      unlocked_at: lockRow.unlocked_at || null,
      unlocked_by_email: lockRow.unlocked_by_email || null,
      is_auto_locked: false,
      deadlines
    };
  }

  // 2. If temporary unlock was set but has expired
  if (tempUnlockExpired) {
    const isManuallyLocked = lockRow ? (lockRow.is_locked === true) : false;
    if (isAutoDeadlineLocked || isManuallyLocked) {
      return {
        is_locked: true,
        effective_status: 'LOCKED',
        is_temp_unlocked: false,
        temp_unlock_expired: true,
        unlocked_until: tempUnlockExpiry,
        lock_reason: isAutoDeadlineLocked
          ? 'Temporary unlock expired; automatic 7-day deadline lock restored'
          : (lockRow.lock_reason || 'Temporary unlock expired; locked by Superadmin'),
        locked_at: lockRow.locked_at || deadlines.attendance_deadline,
        locked_by_email: lockRow.locked_by_email || 'System',
        locked_by_name: lockRow.locked_by_name || (isAutoDeadlineLocked ? 'System (Deadline)' : 'Superadmin'),
        unlocked_at: lockRow.unlocked_at || null,
        unlocked_by_email: lockRow.unlocked_by_email || null,
        is_auto_locked: isAutoDeadlineLocked,
        deadlines
      };
    }
  }

  // 3. Manual lock in ri_attendance_locks
  const isManuallyLocked = lockRow ? (lockRow.is_locked === true) : false;
  if (isManuallyLocked) {
    return {
      is_locked: true,
      effective_status: 'LOCKED',
      is_temp_unlocked: false,
      unlocked_until: null,
      lock_reason: lockRow.lock_reason || (lockRow.locked_by_email ? `Locked by ${lockRow.locked_by_email}` : 'Locked by Faculty / Superadmin'),
      locked_at: lockRow.locked_at,
      locked_by_email: lockRow.locked_by_email,
      locked_by_name: lockRow.locked_by_name,
      unlocked_at: lockRow?.unlocked_at || null,
      unlocked_by_email: lockRow?.unlocked_by_email || null,
      is_auto_locked: false,
      deadlines
    };
  }

  // 4. Auto deadline lock (7 days passed)
  if (isAutoDeadlineLocked) {
    const deadFormatted = deadlines.attendance_deadline
      ? new Date(deadlines.attendance_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    return {
      is_locked: true,
      effective_status: 'LOCKED',
      is_temp_unlocked: false,
      unlocked_until: null,
      lock_reason: `Automatically locked: 7-day deadline passed on ${deadFormatted}`,
      locked_at: deadlines.attendance_deadline,
      locked_by_email: 'system@deadline',
      locked_by_name: 'System (Deadline)',
      unlocked_at: lockRow?.unlocked_at || null,
      unlocked_by_email: lockRow?.unlocked_by_email || null,
      is_auto_locked: true,
      deadlines
    };
  }

  // 5. Default unlocked
  return {
    is_locked: false,
    effective_status: 'UNLOCKED',
    is_temp_unlocked: false,
    unlocked_until: null,
    lock_reason: lockRow?.lock_reason || 'Open for attendance entry',
    locked_at: null,
    locked_by_email: null,
    locked_by_name: null,
    unlocked_at: lockRow?.unlocked_at || null,
    unlocked_by_email: lockRow?.unlocked_by_email || null,
    is_auto_locked: false,
    deadlines
  };
}

module.exports = {
  calculateRiEvaluation,
  calculateRiVisitDeadlines,
  computeEffectiveAttendanceLock,
  RATING_MARKS
};
