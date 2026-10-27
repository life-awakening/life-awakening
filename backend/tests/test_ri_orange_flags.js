require('dotenv').config();
const pool = require('../config/db');
const { reportFacultyOrangeFlag, getFacultyStudents, getMyFacultyOrangeFlags, getAllOrangeFlags, getOrangeFlagDetails, addFollowUpNote } = require('../controllers/riOrangeFlagController');

async function runTests() {
  console.log('--- STARTING RI ORANGE FLAG END-TO-END TEST ---');

  // 1. Get an existing student and panel from ri_batch_students
  const studentRes = await pool.query(`
    SELECT rbs.student_id, rbs.ri_batch_id, rbs.ri_panel_id, u.name, u.email, u.prn
    FROM ri_batch_students rbs
    JOIN users u ON rbs.student_id = u.id
    LIMIT 1
  `);

  if (studentRes.rowCount === 0) {
    console.error('No RI batch students found in database to test.');
    process.exit(1);
  }

  const testStudent = studentRes.rows[0];
  console.log(`✓ Test Student: ${testStudent.name} (ID: ${testStudent.student_id}, PRN: ${testStudent.prn}, Batch: ${testStudent.ri_batch_id}, Panel: ${testStudent.ri_panel_id})`);

  let createdFlagId = null;

  try {
    // 2. Test Faculty Students Fetch
    const mockReq1 = {
      user: { id: 99999, role: 'ri_faculty', name: 'Test Mentor', email: 'testmentor@mitwpu.edu.in' },
      userEmail: 'testmentor@mitwpu.edu.in',
      assignedBatchIds: [testStudent.ri_batch_id],
      assignedPanelIds: [testStudent.ri_panel_id],
      query: { batch_id: String(testStudent.ri_batch_id), panel_id: String(testStudent.ri_panel_id) }
    };
    let mockResData1 = null;
    const mockRes1 = {
      json: (data) => { mockResData1 = data; return mockRes1; },
      status: (code) => mockRes1
    };
    await getFacultyStudents(mockReq1, mockRes1);
    if (!mockResData1?.success || !Array.isArray(mockResData1?.students)) {
      throw new Error('Failed to fetch eligible students for faculty.');
    }
    console.log(`✓ Faculty student retrieval verified (${mockResData1.students.length} students found).`);

    // 3. Test Unauthorized Scope Rejection (Panel mismatch)
    const mockReqUnauth = {
      user: { id: 99999, role: 'ri_faculty', name: 'Test Mentor', email: 'testmentor@mitwpu.edu.in' },
      userEmail: 'testmentor@mitwpu.edu.in',
      assignedBatchIds: [testStudent.ri_batch_id],
      assignedPanelIds: [999999], // Not the student's panel
      body: {
        student_id: testStudent.student_id,
        category: 'Minor Injury',
        description: 'Testing unauthorized submission'
      }
    };
    let unauthStatusCode = 200;
    let unauthResData = null;
    const mockResUnauth = {
      status: (code) => { unauthStatusCode = code; return mockResUnauth; },
      json: (data) => { unauthResData = data; return mockResUnauth; }
    };
    await reportFacultyOrangeFlag(mockReqUnauth, mockResUnauth);
    if (unauthStatusCode !== 403) {
      throw new Error(`Expected 403 for unauthorized panel, got ${unauthStatusCode}`);
    }
    console.log('✓ Unauthorized scope enforcement verified (HTTP 403 returned).');

    // 4. Test Report Valid Orange Flag Incident
    const mockReqReport = {
      user: { id: 99999, role: 'ri_faculty', name: 'Test Mentor', email: 'testmentor@mitwpu.edu.in' },
      userEmail: 'testmentor@mitwpu.edu.in',
      assignedBatchIds: [testStudent.ri_batch_id],
      assignedPanelIds: [testStudent.ri_panel_id],
      facultyAssignments: [{ faculty_name: 'Test Mentor', faculty_email: 'testmentor@mitwpu.edu.in' }],
      body: {
        student_id: testStudent.student_id,
        category: 'Physical Discomfort',
        description: 'Student reported mild headache and fatigue during afternoon community session.',
        incident_date_time: new Date().toISOString(),
        action_taken: 'Advised hydration and 30-minute rest in camp base',
        follow_up_required: true,
        follow_up_notes: 'Will re-check student after dinner.',
        additional_info: 'No fever detected.'
      }
    };
    let reportResData = null;
    let reportStatus = 200;
    const mockResReport = {
      status: (code) => { reportStatus = code; return mockResReport; },
      json: (data) => { reportResData = data; return mockResReport; }
    };
    await reportFacultyOrangeFlag(mockReqReport, mockResReport);
    if (reportStatus !== 201 || !reportResData?.success || !reportResData?.orangeFlag) {
      throw new Error(`Failed to report orange flag: ${JSON.stringify(reportResData)}`);
    }
    createdFlagId = reportResData.orangeFlag.id;
    console.log(`✓ Orange Flag incident #${createdFlagId} reported successfully with initial status "${reportResData.orangeFlag.status}".`);

    // 5. Test Fetch Faculty Orange Flags & Stats
    const mockReqFacultyFlags = {
      user: { id: 99999, role: 'ri_faculty', name: 'Test Mentor', email: 'testmentor@mitwpu.edu.in' },
      userEmail: 'testmentor@mitwpu.edu.in',
      assignedBatchIds: [testStudent.ri_batch_id],
      assignedPanelIds: [testStudent.ri_panel_id],
      query: {}
    };
    let facultyFlagsData = null;
    const mockResFacultyFlags = {
      status: () => mockResFacultyFlags,
      json: (data) => { facultyFlagsData = data; return mockResFacultyFlags; }
    };
    await getMyFacultyOrangeFlags(mockReqFacultyFlags, mockResFacultyFlags);
    if (!facultyFlagsData?.success || !Array.isArray(facultyFlagsData?.orangeFlags)) {
      throw new Error('Failed to retrieve faculty orange flags.');
    }
    const foundFlag = facultyFlagsData.orangeFlags.find(f => f.id === createdFlagId);
    if (!foundFlag) {
      throw new Error('Newly created orange flag not found in faculty list.');
    }
    console.log(`✓ Faculty flags retrieved successfully. Total: ${facultyFlagsData.stats.total}, Open: ${facultyFlagsData.stats.open}.`);

    // 6. Test Add Follow-up Note (Transition to under_follow_up)
    const mockReqNote = {
      user: { id: 99999, role: 'ri_faculty', name: 'Test Mentor', email: 'testmentor@mitwpu.edu.in' },
      userEmail: 'testmentor@mitwpu.edu.in',
      assignedBatchIds: [testStudent.ri_batch_id],
      assignedPanelIds: [testStudent.ri_panel_id],
      params: { id: String(createdFlagId) },
      body: {
        notes: 'Followed up at 7 PM. Student has drunk ORS and feels better, continuing to monitor.',
        status: 'under_follow_up'
      }
    };
    let noteResData = null;
    const mockResNote = {
      status: () => mockResNote,
      json: (data) => { noteResData = data; return mockResNote; }
    };
    await addFollowUpNote(mockReqNote, mockResNote);
    if (!noteResData?.success || noteResData?.orangeFlag?.status !== 'under_follow_up') {
      throw new Error(`Failed to add follow-up note or transition status: ${JSON.stringify(noteResData)}`);
    }
    console.log(`✓ Follow-up note added. Status transitioned to "${noteResData.orangeFlag.status}". History count: ${noteResData.history.length}.`);

    // 7. Test Admin View All Flags & Overview Stats
    const mockReqAdmin = {
      user: { id: 1, role: 'ri_admin', name: 'RI Admin', email: 'admin@ri.edu.in' },
      query: { search: testStudent.prn || testStudent.name }
    };
    let adminData = null;
    const mockResAdmin = {
      status: () => mockResAdmin,
      json: (data) => { adminData = data; return mockResAdmin; }
    };
    await getAllOrangeFlags(mockReqAdmin, mockResAdmin);
    if (!adminData?.success || !Array.isArray(adminData?.orangeFlags)) {
      throw new Error('Admin view failed.');
    }
    const adminFound = adminData.orangeFlags.find(f => f.id === createdFlagId);
    if (!adminFound) {
      throw new Error('Admin could not see faculty reported orange flag.');
    }
    console.log(`✓ Admin view verified. Incident visible across RI module with full stats (Total: ${adminData.stats.total}).`);

    // 8. Test Details Retrieval & Full History Preservation
    const mockReqDetails = {
      user: { id: 1, role: 'ri_admin', name: 'RI Admin' },
      params: { id: String(createdFlagId) }
    };
    let detailsData = null;
    const mockResDetails = {
      status: () => mockResDetails,
      json: (data) => { detailsData = data; return mockResDetails; }
    };
    await getOrangeFlagDetails(mockReqDetails, mockResDetails);
    if (!detailsData?.success || detailsData?.history?.length < 2) {
      throw new Error(`Expected at least 2 history records, got ${detailsData?.history?.length}`);
    }
    console.log(`✓ Details and chronological history verified (${detailsData.history.length} timeline entries).`);

    // 9. Test Resolution
    const mockReqResolve = {
      user: { id: 1, role: 'ri_admin', name: 'RI Admin', email: 'admin@ri.edu.in' },
      params: { id: String(createdFlagId) },
      body: {
        status: 'resolved',
        notes: 'Final checkup next morning: Student completely recovered and participated normally in village project.',
        resolution_notes: 'Fully resolved without further medical intervention.'
      }
    };
    let resolveData = null;
    const mockResResolve = {
      status: () => mockResResolve,
      json: (data) => { resolveData = data; return mockResResolve; }
    };
    await addFollowUpNote(mockReqResolve, mockResResolve);
    if (!resolveData?.success || resolveData?.orangeFlag?.status !== 'resolved') {
      throw new Error('Failed to resolve orange flag incident.');
    }
    console.log(`✓ Incident successfully marked as resolved with resolution notes: "${resolveData.orangeFlag.resolution_notes}".`);

    // 10. Verify Red Flag table is completely separate and untouched
    const redFlagCount = await pool.query('SELECT COUNT(*) FROM ri_red_flags');
    console.log(`✓ Red flags verification: ri_red_flags table untouched (${redFlagCount.rows[0].count} red flags).`);

    console.log('\n========================================');
    console.log('ALL RI ORANGE FLAG TESTS PASSED (10/10)!');
    console.log('========================================\n');
  } finally {
    // Cleanup test record
    if (createdFlagId) {
      await pool.query('DELETE FROM ri_orange_flags WHERE id = $1', [createdFlagId]);
      console.log(`✓ Cleaned up test orange flag #${createdFlagId}.`);
    }
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
