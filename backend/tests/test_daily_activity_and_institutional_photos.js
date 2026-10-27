const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('Testing Daily Activity Report (Form IIIB) & Institutional Visits (Form IV) Photo Uploads...');

  // 1. Get a test student
  const studentRes = await pool.query(`
    SELECT u.id, u.name, u.email, rbs.ri_batch_id, rbs.ri_panel_id
    FROM users u
    JOIN ri_batch_students rbs ON rbs.student_id = u.id
    LIMIT 1
  `);

  if (studentRes.rows.length === 0) {
    console.error('No students found in DB!');
    process.exit(1);
  }

  const student = studentRes.rows[0];
  console.log(`Found test student: ${student.name} (ID: ${student.id}, Batch: ${student.ri_batch_id})`);

  const riStudentController = require('../controllers/riStudentController');

  // Test 1: Upload validation for Institutional Visits photo
  console.log('\n--- TEST 1: Institutional Visits Photo Upload Validation ---');
  
  // 1a. Unsupported file format rejection
  let mockRes1a = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.uploadInstitutionalPhoto({
    user: { id: student.id },
    protocol: 'http',
    get: () => 'localhost:5001',
    file: {
      originalname: 'malicious.exe',
      filename: 'test_file.exe',
      size: 1024
    }
  }, mockRes1a);
  console.log(`Format rejection test: HTTP ${mockRes1a.statusCode} - ${mockRes1a.body?.message}`);
  if (mockRes1a.statusCode !== 400) throw new Error('Expected 400 for invalid file extension');

  // 1b. Exceeds 5MB rejection
  let mockRes1b = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.uploadInstitutionalPhoto({
    user: { id: student.id },
    protocol: 'http',
    get: () => 'localhost:5001',
    file: {
      originalname: 'huge_photo.jpg',
      filename: 'huge_photo.jpg',
      size: 6 * 1024 * 1024 // 6 MB
    }
  }, mockRes1b);
  console.log(`Size > 5MB rejection test: HTTP ${mockRes1b.statusCode} - ${mockRes1b.body?.message}`);
  if (mockRes1b.statusCode !== 400) throw new Error('Expected 400 for file exceeding 5MB');

  // 1c. Valid upload
  let mockRes1c = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.uploadInstitutionalPhoto({
    user: { id: student.id },
    protocol: 'http',
    get: () => 'localhost:5001',
    file: {
      originalname: 'field_visit_school.jpg',
      filename: 'field_visit_school.jpg',
      size: 2 * 1024 * 1024 // 2 MB
    }
  }, mockRes1c);
  console.log(`Valid photo upload test: HTTP ${mockRes1c.statusCode} - ${mockRes1c.body?.url}`);
  if (mockRes1c.statusCode !== 200 || !mockRes1c.body?.url) throw new Error('Expected valid photo URL');
  const uploadedInstPhoto1 = mockRes1c.body.url;
  const uploadedInstPhoto2 = 'http://localhost:5001/api/uploads/ri_student_files/gram_panchayat_discussion.webp';

  // Test 2: Institutional Visits Save Draft & Fetch with Photos
  console.log('\n--- TEST 2: Save Institutional Visits with Activity Photos ---');
  let mockResSaveInst = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.saveInstitutionalVisits({
    user: { id: student.id },
    body: {
      visits: [
        {
          institution_type: 'Gram Panchayat Office',
          institution_name: 'Pimpalgaon Gram Panchayat',
          visit_date: '2026-10-10',
          official_contact_person: 'Ramesh Patil',
          official_designation: 'Gram Sevak',
          services_provided: 'Drinking water, sanitation, tax collection',
          key_observations: 'Well maintained records of water disinfection',
          challenges_identified: 'Need better digital internet infrastructure',
          recommendations: 'Fiber internet connection for online 7/12 records',
          drinking_water_available: true,
          toilet_available: true,
          electricity_available: true,
          infrastructure_condition: 'Good Condition'
        },
        {
          institution_type: 'Primary Health Centre (PHC) / Sub-Centre',
          institution_name: 'Pimpalgaon Sub Centre',
          visit_date: '2026-10-10',
          official_contact_person: 'Dr. Sunita Kulkarni',
          official_designation: 'Medical Officer',
          services_provided: 'OPD, immunization, maternal health',
          key_observations: 'Regular immunization sessions held every Wednesday',
          challenges_identified: 'Shortage of cold storage backup',
          recommendations: 'Solar backup for vaccine refrigerators',
          drinking_water_available: true,
          toilet_available: true,
          electricity_available: true,
          infrastructure_condition: 'Good Condition'
        }
      ],
      form_sections: {
        section_1_village_info: {
          v_1_1_village_name: 'Pimpalgaon',
          v_1_2_taluka: 'Daund',
          v_1_3_district: 'Pune',
          v_1_4_tribal: 'Non tribal',
          v_1_5_population: '2500 - 4999'
        }
      },
      activity_photo_1: uploadedInstPhoto1,
      activity_photo_2: uploadedInstPhoto2,
      status: 'Draft',
      is_final_submit: false
    }
  }, mockResSaveInst);
  console.log(`Save Institutional Visits response: HTTP ${mockResSaveInst.statusCode} - ${mockResSaveInst.body?.message}`);
  if (mockResSaveInst.statusCode !== 200) throw new Error('Failed to save institutional visits');

  // Verify getInstitutionalVisits returns activity photos
  let mockResGetInst = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.getInstitutionalVisits({
    user: { id: student.id }
  }, mockResGetInst);
  console.log('getInstitutionalVisits verified:');
  console.log(`  activity_photo_1: ${mockResGetInst.body?.activity_photo_1}`);
  console.log(`  activity_photo_2: ${mockResGetInst.body?.activity_photo_2}`);
  if (mockResGetInst.body?.activity_photo_1 !== uploadedInstPhoto1 || mockResGetInst.body?.activity_photo_2 !== uploadedInstPhoto2) {
    throw new Error('Institutional visit photos not preserved correctly!');
  }

  // Test 3: Daily Activity Report (Form IIIB) Photo Upload Validation
  console.log('\n--- TEST 3: Form IIIB Daily Activity Photo Upload Validation ---');
  let mockResDarPhoto = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.uploadDailyActivityPhoto({
    user: { id: student.id },
    protocol: 'http',
    get: () => 'localhost:5001',
    file: {
      originalname: 'community_cleaning_shramdaan.jpg',
      filename: 'community_cleaning_shramdaan.jpg',
      size: 1.5 * 1024 * 1024
    }
  }, mockResDarPhoto);
  console.log(`Daily Activity photo upload: HTTP ${mockResDarPhoto.statusCode} - ${mockResDarPhoto.body?.url}`);
  if (mockResDarPhoto.statusCode !== 200 || !mockResDarPhoto.body?.url) throw new Error('Expected valid photo URL for DAR');
  const darPhoto1 = mockResDarPhoto.body.url;
  const darPhoto2 = 'http://localhost:5001/api/uploads/ri_student_files/tree_plantation_event.png';

  // Test 4: Daily Activity Report (Form IIIB) Save Draft with all official Table 135 indicators
  console.log('\n--- TEST 4: Save Form IIIB with Official RUIP Table 135 Indicators ---');
  let mockResSaveDar = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.saveDailyActivityReport({
    user: { id: student.id },
    body: {
      student_name: student.name,
      school_name: 'School of Engineering and Technology',
      degree_program: 'B.Tech Mechanical Engineering',
      village_visited: 'Pimpalgaon',
      total_days_in_village: '5 Days',
      seven_day_plan_completed: 'Yes',
      seven_day_plan_improvements: 'More time for evening debriefs with village sarpanch',
      community_project_types: ['Shramadan – cleaning', 'Tree plantation'],
      community_project_other_text: '',
      community_project_work_done: 'Cleaned school drainage area and planted 25 neem saplings',
      community_project_suggestions: 'Supply better hand tools and tree guards',
      study_group_included: 'Yes',
      study_problem_title: 'Unsegregated plastic waste blocking seasonal farm waterways',
      study_solution_submitted: 'Yes',
      study_presented_to_committee: 'Yes',
      study_suggestions: 'Include local gram panchayat peon in preliminary discussion',
      institutions_visited_count: 3,
      institutional_visits_suggestions: 'More structured questionnaire for PHC staff',
      homes_visited_count: 5,
      home_visits_suggestions: 'Visit families during evening hours for better availability',
      best_practices_observed: 'Community vermicomposting pits in ward 3',
      other_activities_implemented: 'Conducted road safety session with village high school youth',
      issues_affecting_implementation: 'Cellular network dead zones in low lying farm areas',
      suggestions_to_improve_program: 'Provide printed village boundary maps',
      remarks: 'Productive learning experience in rural development',
      activity_photo_1: darPhoto1,
      activity_photo_2: darPhoto2,
      status: 'Draft',
      is_final_submit: false
    }
  }, mockResSaveDar);
  console.log(`Save Form IIIB response: HTTP ${mockResSaveDar.statusCode} - ${mockResSaveDar.body?.message}`);
  if (mockResSaveDar.statusCode !== 200) throw new Error('Failed to save Form IIIB draft');

  // Verify getDailyActivityReport loads all indicators
  let mockResGetDar = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.getDailyActivityReport({
    user: { id: student.id }
  }, mockResGetDar);
  console.log('getDailyActivityReport verified:');
  const dar = mockResGetDar.body?.report;
  console.log(`  School: ${dar?.school_name}`);
  console.log(`  Village: ${dar?.village_visited}`);
  console.log(`  Plan Completed: ${dar?.seven_day_plan_completed}`);
  console.log(`  Problem Title: ${dar?.study_problem_title}`);
  console.log(`  Institutions Count: ${dar?.institutions_visited_count}`);
  console.log(`  Homes Count: ${dar?.homes_visited_count}`);
  console.log(`  Photo 1: ${dar?.activity_photo_1}`);
  console.log(`  Photo 2: ${dar?.activity_photo_2}`);
  if (
    dar?.school_name !== 'School of Engineering and Technology' ||
    dar?.seven_day_plan_completed !== 'Yes' ||
    dar?.study_problem_title !== 'Unsegregated plastic waste blocking seasonal farm waterways' ||
    dar?.activity_photo_1 !== darPhoto1 ||
    dar?.activity_photo_2 !== darPhoto2
  ) {
    throw new Error('Form IIIB report data mismatch!');
  }

  // Test 5: Verify Final Submit
  console.log('\n--- TEST 5: Final Submission of Form IIIB ---');
  let mockResSubmitDar = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await riStudentController.saveDailyActivityReport({
    user: { id: student.id },
    body: {
      ...dar,
      status: 'Submitted',
      is_final_submit: true
    }
  }, mockResSubmitDar);
  console.log(`Form IIIB Final Submit response: HTTP ${mockResSubmitDar.statusCode} - ${mockResSubmitDar.body?.message}`);
  if (mockResSubmitDar.statusCode !== 200) throw new Error('Final submit failed');

  // Verify master status is Submitted
  const formStatus = await pool.query(`
    SELECT status, progress_percent FROM ri_student_forms
    WHERE student_id = $1 AND form_type = 'DAILY_ACTIVITY_REPORT'
  `, [student.id]);
  console.log(`ri_student_forms record: status=${formStatus.rows[0]?.status}, progress=${formStatus.rows[0]?.progress_percent}%`);
  if (formStatus.rows[0]?.status !== 'Submitted' || formStatus.rows[0]?.progress_percent !== 100) {
    throw new Error('Form IIIB status not updated to Submitted with 100% progress');
  }

  // Test 6: Verify Faculty Workspace Visibility
  console.log('\n--- TEST 6: Faculty Workspace Inspection ---');
  const riFacultyController = require('../controllers/riFacultyController');
  let mockResFaculty = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  const mockReq = {
    user: { id: student.id, role: 'superadmin' },
    params: { studentId: String(student.id) },
    query: { 
      batch_id: String(student.ri_batch_id),
      panel_id: String(student.ri_panel_id)
    },
    isRiAdminPreview: true
  };
  await riFacultyController.getStudentSubmissionDetail(mockReq, mockResFaculty);
  const facultyData = mockResFaculty.body;
  console.log(`Faculty sees daily_activity: ${Boolean(facultyData?.daily_activity)}`);
  console.log(`Faculty sees institutional_visits: ${facultyData?.institutional_visits?.length} visits`);
  console.log(`Faculty sees inst visit photo 1: ${facultyData?.institutional_visits?.[0]?.activity_photo_1}`);
  if (!facultyData?.daily_activity) throw new Error('Faculty cannot see daily activity record');
  if (facultyData?.institutional_visits?.[0]?.activity_photo_1 !== uploadedInstPhoto1) {
    throw new Error('Faculty cannot see institutional visit photo 1');
  }

  console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
