const XLSX = require('xlsx');

/**
 * Format a workbook sheet with auto column widths and freeze top header row
 */
function styleWorksheet(ws, rows) {
  if (!rows || rows.length === 0) return;
  const colKeys = Object.keys(rows[0]);
  const colWidths = colKeys.map(key => {
    let maxLen = String(key).length;
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      const val = rows[i][key];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
  });
  ws['!cols'] = colWidths;
  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
}

/**
 * 1. RI Attendance Excel (Multi-Sheet for 4 Activities)
 */
function createAttendanceWorkbook({
  batchName,
  panelName,
  summaryRows = [],
  schoolActivityRows = [],
  institutionalVisitRows = [],
  familySurveyRows = [],
  communityProjectRows = [],
  activitySheets = []
}) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  styleWorksheet(wsSummary, summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Attendance Summary');

  // Activity Sheets
  if (activitySheets && activitySheets.length > 0) {
    activitySheets.forEach(sheet => {
      const ws = XLSX.utils.json_to_sheet(sheet.rows || []);
      styleWorksheet(ws, sheet.rows || []);
      XLSX.utils.book_append_sheet(wb, ws, sheet.title || 'Activity');
    });
  } else {
    // 1. School Activity
    const wsSchool = XLSX.utils.json_to_sheet(schoolActivityRows);
    styleWorksheet(wsSchool, schoolActivityRows);
    XLSX.utils.book_append_sheet(wb, wsSchool, 'School Activity');

    // 2. Institutional Visit
    const wsInst = XLSX.utils.json_to_sheet(institutionalVisitRows);
    styleWorksheet(wsInst, institutionalVisitRows);
    XLSX.utils.book_append_sheet(wb, wsInst, 'Institutional Visit');

    // 3. Family Visit
    const wsFam = XLSX.utils.json_to_sheet(familySurveyRows);
    styleWorksheet(wsFam, familySurveyRows);
    XLSX.utils.book_append_sheet(wb, wsFam, 'Family Visit');

    // 4. Community Project
    const wsComm = XLSX.utils.json_to_sheet(communityProjectRows);
    styleWorksheet(wsComm, communityProjectRows);
    XLSX.utils.book_append_sheet(wb, wsComm, 'Community Project');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 2. RI Student Forms Excel (Multi-Sheet)
 */
function createFormsWorkbook({ summaryRows, responsesRows, pendingRows }) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Submission Summary
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  styleWorksheet(wsSummary, summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Submission Summary');

  // Sheet 2: Form Responses
  const wsResponses = XLSX.utils.json_to_sheet(responsesRows);
  styleWorksheet(wsResponses, responsesRows);
  XLSX.utils.book_append_sheet(wb, wsResponses, 'Form Responses');

  // Sheet 3: Pending Submissions
  const wsPending = XLSX.utils.json_to_sheet(pendingRows);
  styleWorksheet(wsPending, pendingRows);
  XLSX.utils.book_append_sheet(wb, wsPending, 'Pending Submissions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 3. RI Evaluation Excel (Multi-Sheet)
 */
function createEvaluationWorkbook({ summaryRows, criterionRows, remarksRows }) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Evaluation Summary
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  styleWorksheet(wsSummary, summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Evaluation Summary');

  // Sheet 2: Criterion-wise Evaluation
  const wsCriterion = XLSX.utils.json_to_sheet(criterionRows);
  styleWorksheet(wsCriterion, criterionRows);
  XLSX.utils.book_append_sheet(wb, wsCriterion, 'Criterion-wise Rubric');

  // Sheet 3: Faculty Remarks
  const wsRemarks = XLSX.utils.json_to_sheet(remarksRows);
  styleWorksheet(wsRemarks, remarksRows);
  XLSX.utils.book_append_sheet(wb, wsRemarks, 'Faculty Remarks & Notes');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 4. Family Visit Excel (Multi-Sheet)
 */
function createFamilySurveyWorkbook({ summaryRows, detailRows }) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  styleWorksheet(wsSummary, summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Family Visit Summary');

  // Sheet 2: Details
  const wsDetails = XLSX.utils.json_to_sheet(detailRows);
  styleWorksheet(wsDetails, detailRows);
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Family-wise Details');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 5. Community Projects Excel
 */
function createCommunityProjectWorkbook({ rows }) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  styleWorksheet(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Community Projects');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 6. Institutional Visits Excel
 */
function createInstitutionalVisitWorkbook({ rows }) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  styleWorksheet(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Institutional Visits');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * 7. Overall RI Assessment Excel
 */
function createOverallAssessmentWorkbook({ rows }) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  styleWorksheet(ws, rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Overall Assessment Report');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  createAttendanceWorkbook,
  createFormsWorkbook,
  createEvaluationWorkbook,
  createFamilySurveyWorkbook,
  createCommunityProjectWorkbook,
  createInstitutionalVisitWorkbook,
  createOverallAssessmentWorkbook
};
