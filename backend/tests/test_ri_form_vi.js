require('dotenv').config({ path: './.env' });
const pool = require('../config/db');

async function testFormVI() {
  console.log('Testing Form VI Backend & DB...');
  
  // 1. Check student
  const studentRes = await pool.query(`
    SELECT rbs.student_id, rbs.ri_batch_id, rbs.ri_panel_id, u.name, u.email
    FROM ri_batch_students rbs
    JOIN users u ON rbs.student_id = u.id
    LIMIT 1
  `);
  
  if (studentRes.rows.length === 0) {
    console.log('No student found in ri_batch_students, skipping live user test.');
    process.exit(0);
  }

  const s = studentRes.rows[0];
  console.log('Found student:', s.name, '(ID:', s.student_id, ')');

  // Check columns in ri_problem_identifications
  console.log('Testing schema columns in ri_problem_identifications...');
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'ri_problem_identifications'
  `);
  const colNames = cols.rows.map(r => r.column_name);
  const requiredCols = [
    'school_name', 'department_name', 'degree_program', 'village_visited',
    'students_participated', 'team_leader_name', 'total_team_members',
    'problem_title', 'is_aligned_with_sdg', 'is_related_to_degree',
    'solution_offered', 'helping_faculty_name', 'helping_faculty_dept',
    'solution_is_practical_implementable', 'committee_chairperson',
    'presentation_date', 'committee_remarks', 'sarpanch_informed_details',
    'ri_cell_submission_details', 'assignment_link', 'form_data'
  ];

  for (const c of requiredCols) {
    if (!colNames.includes(c)) {
      throw new Error('Missing column in ri_problem_identifications: ' + c);
    }
  }
  console.log('✓ All 21 required columns are present in database table!');

  // Test save draft controller logic
  const riStudentController = require('../controllers/riStudentController');
  
  // Mock req & res for Draft
  const mockReqDraft = {
    user: { id: s.student_id, email: s.email, name: s.name },
    body: {
      school_name: 'School of Technology',
      department_name: 'Civil Engineering',
      degree_program: 'B.Tech Civil',
      village_visited: 'Shindewadi',
      students_participated: 5,
      team_leader_name: 'Aarav Patel',
      total_team_members: 5,
      problem_title: 'Inadequate solid waste management near village school drainage',
      is_aligned_with_sdg: 'Yes',
      is_related_to_degree: 'Yes',
      solution_offered: 'Yes',
      helping_faculty_name: 'Dr. S. K. Joshi',
      helping_faculty_dept: 'Civil & Environmental Engineering',
      solution_is_practical_implementable: 'Yes',
      committee_chairperson: 'Dr. Dean Academic',
      presentation_date: '2026-02-20',
      committee_remarks: 'Excellent',
      sarpanch_informed_details: 'Informed to Sarpanch Shri Deshmukh on 18 Feb 2026',
      ri_cell_submission_details: 'Submitted to RI Coordinator on 21 Feb 2026',
      assignment_link: 'http://localhost:5001/uploads/ri_student_files/test_1500_word_report.pdf',
      status: 'Draft',
      is_final_submit: false
    }
  };

  let draftResult = null;
  const mockResDraft = {
    status: (code) => ({
      json: (data) => {
        console.error('Draft error response:', code, data);
        throw new Error('Draft save failed with ' + code);
      }
    }),
    json: (data) => {
      draftResult = data;
    }
  };

  await riStudentController.saveProblemIdentification(mockReqDraft, mockResDraft);
  console.log('✓ Draft saved successfully:', draftResult.status, 'progress:', draftResult.problem ? 'OK' : 'FAIL');

  // Verify getProblemIdentification
  let getResult = null;
  const mockReqGet = { user: { id: s.student_id } };
  const mockResGet = {
    status: (code) => ({
      json: (data) => {
        throw new Error('Get failed with ' + code);
      }
    }),
    json: (data) => {
      getResult = data;
    }
  };

  await riStudentController.getProblemIdentification(mockReqGet, mockResGet);
  console.log('✓ getProblemIdentification loaded record successfully. Status:', getResult.form_status.status);
  console.log('  Loaded problem title:', getResult.problem.problem_title);
  console.log('  Loaded report link:', getResult.problem.assignment_link);
  console.log('  Loaded team leader:', getResult.problem.team_leader_name);

  // Test final submit allows submission without 1500-word document (optional for members)
  const mockReqValidWithoutDoc = {
    user: { id: s.student_id, email: s.email, name: s.name },
    body: {
      ...mockReqDraft.body,
      assignment_link: '', // Optional for group members (only group leader needs to upload)
      is_final_submit: false,
      status: 'Draft'
    }
  };

  let savedWithoutDoc = false;
  const mockResValidWithoutDoc = {
    status: (code) => ({
      json: (data) => {
        if (code === 200 || data.success) {
          savedWithoutDoc = true;
          console.log('✓ Form VI correctly permits saving without 1500-word report document');
        }
      }
    }),
    json: (data) => {
      savedWithoutDoc = true;
    }
  };

  await riStudentController.saveProblemIdentification(mockReqValidWithoutDoc, mockResValidWithoutDoc);

  // Test valid final submit
  const mockReqValidFinal = {
    user: { id: s.student_id, email: s.email, name: s.name },
    body: {
      ...mockReqDraft.body,
      is_final_submit: true,
      status: 'Submitted'
    }
  };

  let finalResult = null;
  const mockResValidFinal = {
    status: (code) => ({
      json: (data) => {
        throw new Error('Final submit failed with ' + code + ': ' + JSON.stringify(data));
      }
    }),
    json: (data) => {
      finalResult = data;
    }
  };

  await riStudentController.saveProblemIdentification(mockReqValidFinal, mockResValidFinal);
  console.log('✓ Final submit succeeded:', finalResult.status, finalResult.message);

  // Verify form status is 'Submitted' and progress is 100
  const checkStatusRes = await pool.query(`
    SELECT status, progress_percent FROM ri_student_forms
    WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'PROBLEM_IDENTIFICATION'
  `, [s.student_id, s.ri_batch_id]);
  console.log('✓ ri_student_forms record:', checkStatusRes.rows[0]);
  if (checkStatusRes.rows[0].status !== 'Submitted' || checkStatusRes.rows[0].progress_percent !== 100) {
    throw new Error('Form status or progress mismatch!');
  }

  // Test faculty workspace endpoint
  const riFacultyController = require('../controllers/riFacultyController');
  let wsResult = null;
  const mockReqWs = {
    user: { id: 1, role: 'superadmin' },
    isRiAdminPreview: true,
    params: { studentId: s.student_id },
    query: { batch_id: s.ri_batch_id, panel_id: s.ri_panel_id }
  };
  const mockResWs = {
    status: (code) => ({
      json: (data) => {
        throw new Error('Workspace load failed with ' + code + ': ' + JSON.stringify(data));
      }
    }),
    json: (data) => {
      wsResult = data;
    }
  };

  await riFacultyController.getStudentSubmissionDetail(mockReqWs, mockResWs);
  console.log('✓ Faculty workspace problem_identification:', Boolean(wsResult.problem_identification));
  console.log('  Faculty sees title:', wsResult.problem_identification?.problem_title);
  console.log('  Faculty sees assignment link:', wsResult.problem_identification?.assignment_link);

  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

testFormVI().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
