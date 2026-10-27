const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

function apiRequest({ method = 'GET', path, token, body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5001,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('🧪 VERIFICATION TEST: EDIT SUBMITTED RESPONSE FOR ALL 5 RI FORMS');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // 1. Find a test student with batch and panel assignments
    const studentQuery = await pool.query(`
      SELECT u.id as student_id, u.prn, u.name as student_name, u.email,
             rbs.ri_panel_id, rbs.ri_batch_id, rp.name as panel_name,
             rb.name as batch_name
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_evaluations re ON re.student_id = rbs.student_id AND re.ri_batch_id = rbs.ri_batch_id
      WHERE (re.evaluation_status IS NULL OR re.evaluation_status NOT IN ('Submitted', 'Completed'))
      ORDER BY u.id ASC
      LIMIT 2
    `);

    if (studentQuery.rowCount < 1) {
      console.error('❌ No assigned students found in database for test.');
      process.exit(1);
    }

    const testStudent = studentQuery.rows[0];
    const secondStudent = studentQuery.rows[1] || null;

    console.log(`📌 Primary Test Student: ${testStudent.student_name} (PRN: ${testStudent.prn}, ID: ${testStudent.student_id})`);
    console.log(`📌 Batch: ${testStudent.batch_name} (ID: ${testStudent.ri_batch_id})\n`);

    const token = jwt.sign(
      { id: testStudent.student_id, email: testStudent.email, role: 'student' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // =========================================================================
    // TEST 1: DAILY ACTIVITY REPORT (FORM IIIB)
    // =========================================================================
    console.log('--- [FORM 1] DAILY ACTIVITY REPORT (FORM IIIB) ---');
    const initialDarPayload = {
      status: 'Submitted',
      is_final_submit: true,
      student_name: testStudent.student_name,
      school_name: 'School of Technology',
      degree_program: 'B.Tech CSE',
      village_visited: testStudent.village_name || 'Daund Test Village',
      total_days_in_village: '5 Days',
      seven_day_plan_completed: 'Yes',
      seven_day_plan_improvements: 'Initial Plan Notes',
      community_project_types: ['Tree Plantation'],
      community_project_work_done: 'Planted 10 saplings in primary school ground',
      community_project_suggestions: 'Regular follow-up with village panchayat and school headmaster',
      study_group_included: 'Yes',
      study_problem_title: 'Water drainage issue near market',
      study_solution_submitted: 'Yes',
      study_presented_to_committee: 'Yes',
      institutions_visited_count: 3,
      homes_visited_count: 5,
      school_activity_types: ['Career Guidance'],
      school_name_engaged: 'Zilla Parishad High School',
      school_students_count: 45,
      school_activity_details: 'Conducted interactive digital literacy workshop'
    };

    const darSubmitRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/daily-activity-report',
      token,
      body: initialDarPayload
    });

    if (darSubmitRes.status !== 200) {
      console.error('darSubmitRes failure details:', darSubmitRes.status, darSubmitRes.body);
    }

    assert(darSubmitRes.status === 200 && darSubmitRes.body.status === 'Submitted',
      'Daily Activity Report submitted successfully with status "Submitted"');

    // Query DB to inspect submission_timestamp
    const darDb1 = await pool.query(`
      SELECT id, status, submission_timestamp, last_updated_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'DAILY_ACTIVITY_REPORT'
    `, [testStudent.student_id, testStudent.ri_batch_id]);
    const darOrigTimestamp = darDb1.rows[0].submission_timestamp;
    assert(darOrigTimestamp !== null, 'Original submission_timestamp recorded');

    // Attempt quiet draft autosave downgrade -> should be blocked (409)
    const darDraftAttempt = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/daily-activity-report',
      token,
      body: { ...initialDarPayload, status: 'Draft', is_final_submit: false }
    });
    assert(darDraftAttempt.status === 409 && darDraftAttempt.body.locked === true,
      'Quiet draft autosave is blocked from downgrading submitted form to Draft');

    // Now perform "Edit Response & Update"
    const darUpdateRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/daily-activity-report',
      token,
      body: {
        ...initialDarPayload,
        is_update_response: true,
        seven_day_plan_improvements: 'UPDATED: Added water filtration analysis and soil testing',
        community_project_work_done: 'UPDATED: Planted 25 indigenous trees and installed drip irrigation'
      }
    });
    assert(darUpdateRes.status === 200 && darUpdateRes.body.status === 'Submitted',
      'Edit Response successfully updated and resubmitted Form IIIB');

    // Verify DB integrity & no duplicate records
    const darDb2 = await pool.query(`
      SELECT count(*) as form_count,
             min(submission_timestamp) as sub_time,
             max(last_updated_at) as upd_time
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'DAILY_ACTIVITY_REPORT'
    `, [testStudent.student_id, testStudent.ri_batch_id]);
    assert(parseInt(darDb2.rows[0].form_count, 10) === 1,
      'ri_student_forms record count is exactly 1 (zero duplicates created)');
    assert(new Date(darDb2.rows[0].sub_time).getTime() === new Date(darOrigTimestamp).getTime(),
      'Original submission_timestamp preserved intact');

    const darChild = await pool.query(`
      SELECT count(*) as child_count, seven_day_plan_improvements, community_project_work_done
      FROM ri_daily_activity_reports
      WHERE student_id = $1 AND ri_batch_id = $2
      GROUP BY seven_day_plan_improvements, community_project_work_done
    `, [testStudent.student_id, testStudent.ri_batch_id]);
    assert(parseInt(darChild.rows[0].child_count, 10) === 1,
      'ri_daily_activity_reports child record count is exactly 1');
    assert(darChild.rows[0].seven_day_plan_improvements.includes('UPDATED: Added water filtration'),
      'Updated values persist in database correctly');

    // =========================================================================
    // TEST 2: INSTITUTIONAL VISIT OBSERVATIONS (FORM IV)
    // =========================================================================
    console.log('\n--- [FORM 2] INSTITUTIONAL VISIT OBSERVATIONS (FORM IV) ---');
    const sampleFormSections = {
      section_1_village_info: {
        v_1_1_village_name: 'Kasurdi',
        v_1_2_taluka: 'Daund',
        v_1_3_district: 'Pune',
        v_1_4_tribal: '2) Non tribal',
        v_1_5_population: '3) 2500 - 4999'
      },
      section_2_gram_panchayat: {
        gp_2_2_water_supply: '1) Tap water - public',
        gp_2_3_water_adequate: '1) Yes',
        gp_2_4_disinfection_frequency: '1) Daily',
        gp_2_5_bleaching_powder: '1) Yes',
        gp_2_6_chemical_analysis: '1) Yes',
        gp_2_7_bacterial_analysis: '1) Yes',
        gp_2_8_street_lights: '1) Yes',
        gp_2_9_drainage: '1) Closed gutters',
        gp_2_1_solid_waste: '1) Yes'
      },
      section_3_legal_cases: {
        lc_3_1_police_patil: '1) Yes',
        lc_3_2_tanta_mukta: '1) Yes',
        lc_3_3_cases_resolved: '2) 1-5 cases'
      },
      section_4_school: {
        sc_4_1_students_count: '3) 200-499 students',
        sc_4_2_medium: '1) Marathi',
        sc_4_3_building_condition: '1) Good Condition',
        sc_4_4_toilets: '1) Yes',
        sc_4_5_drinking_water: '1) Yes'
      },
      section_5_health_facility: {
        hf_5_1_facility_type: '2) Sub Centre',
        hf_5_5_deliveries_conducted: '1) Yes',
        hf_5_6_emergency_services: '1) Yes',
        hf_5_7_ambulance_available: '1) Yes',
        hf_5_9_asha_referral: '1) Yes'
      },
      section_6_anganwadi: {
        aw_6_1_anganwadi_present: '1) Yes',
        aw_6_2_supplementary_nutrition: '1) Yes',
        aw_6_3_food_not_available_days: '1) All functioning days available'
      },
      section_7_ration_shop: {
        rs_7_1_ration_shop_available: '1) Yes',
        rs_7_2_food_items_regular: '1) Yes',
        rs_7_3_bpl_ration_subsidised: '1) Yes'
      },
      section_8_talathi_sajja: {
        ts_8_1_talathi_available: '1) Yes',
        ts_8_3_satbara_online: '1) Yes'
      },
      section_9_special_scheme: {
        ss_9_special_scheme_details: 'Sant Gadge Baba Gram Swachhata Abhiyan'
      }
    };

    const initialInstPayload = {
      status: 'Submitted',
      is_final_submit: true,
      visits: [
        {
          institution_name: 'Gram Panchayat Kasurdi',
          visit_date: '2026-10-15',
          official_contact_person: 'Shri Ramesh Patil (Gram Sevak)',
          services_provided: 'Tax assessment, birth/death registration',
          observations: 'Initial observation of GP records',
          challenges_identified: 'Lack of computer operator',
          recommendations: 'Deploy digital literacy student volunteer'
        },
        {
          institution_name: 'Primary Health Centre (PHC)',
          visit_date: '2026-10-16',
          official_contact_person: 'Dr. Sunita Deshmukh (Medical Officer)',
          services_provided: 'Primary healthcare OPD and immunization',
          observations: 'Well stocked OPD and delivery room',
          challenges_identified: 'Infrequent ambulance servicing',
          recommendations: 'Coordination with taluka hospital'
        }
      ],
      form_sections: sampleFormSections
    };

    const instSubmitRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/institutional-visits',
      token,
      body: initialInstPayload
    });

    if (instSubmitRes.status !== 200) {
      console.error('instSubmitRes error:', instSubmitRes.status, instSubmitRes.body);
    }
    assert(instSubmitRes.status === 200 && instSubmitRes.body.status === 'Submitted',
      'Institutional Visits submitted successfully with status "Submitted"');

    // Block draft downgrade
    const instDraftAttempt = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/institutional-visits',
      token,
      body: { ...initialInstPayload, status: 'Draft', is_final_submit: false }
    });
    assert(instDraftAttempt.status === 409 && instDraftAttempt.body.locked === true,
      'Quiet draft autosave is blocked on submitted Institutional Visits');

    // Edit response
    const instUpdateRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/institutional-visits',
      token,
      body: {
        ...initialInstPayload,
        is_update_response: true,
        visits: [
          {
            ...initialInstPayload.visits[0],
            observations: 'UPDATED: Inspected 7/12 land digitisation records and tax collection ledger',
            key_observations: 'UPDATED: Inspected 7/12 land digitisation records and tax collection ledger'
          },
          initialInstPayload.visits[1]
        ]
      }
    });
    assert(instUpdateRes.status === 200 && instUpdateRes.body.status === 'Submitted',
      'Edit Response successfully updated Institutional Visits');

    const instDb = await pool.query(`
      SELECT count(*) as count, string_agg(key_observations, ' | ') as obs
      FROM ri_institutional_visits
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [testStudent.student_id, testStudent.ri_batch_id]);
    assert(parseInt(instDb.rows[0].count, 10) === 2,
      'Exactly 2 visit records retained in database (no duplicates)');
    assert(instDb.rows[0].obs.includes('UPDATED: Inspected 7/12 land digitisation'),
      'Updated institutional visit observations persisted correctly');

    // =========================================================================
    // TEST 3: FAMILY VISIT OBSERVATIONS (FORM V)
    // =========================================================================
    console.log('\n--- [FORM 3] FAMILY VISIT OBSERVATIONS (FORM V) ---');
    // Ensure we have 3 villages for family survey requirement
    const villagesRes = await pool.query(`
      SELECT id, name FROM ri_villages WHERE ri_batch_id = $1 LIMIT 3
    `, [testStudent.ri_batch_id]);
    const vList = villagesRes.rows;
    const v1 = vList[0]?.name || testStudent.village_name || 'Village A';
    const v2 = vList[1]?.name || 'Village B';
    const v3 = vList[2]?.name || 'Village C';

    // Save 3 families
    for (let i = 1; i <= 3; i++) {
      const vName = i === 1 ? v1 : i === 2 ? v2 : v3;
      await apiRequest({
        method: 'POST',
        path: '/api/ri/student/forms/family-surveys',
        token,
        body: {
          family_serial_number: i,
          head_of_family_name: `Family Head #${i}`,
          total_family_members: 4,
          respondent_name: `Respondent #${i}`,
          contact_number: `987654320${i}`,
          village_name: vName,
          category: 'OBC',
          annual_income: 120000,
          ration_card_type: 'Orange',
          is_draft: true
        }
      });
    }

    // Submit all families
    const famSubmitRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/family-surveys/submit-all',
      token,
      body: { is_final_submit: true }
    });

    if (famSubmitRes.status !== 200) {
      console.error('famSubmitRes error:', famSubmitRes.status, famSubmitRes.body);
    }
    assert(famSubmitRes.status === 200 && famSubmitRes.body.status === 'Submitted',
      'Family Visit Observations (Form V) submitted with status "Submitted"');

    // Attempt modifying individual family without editing mode -> blocked
    const famEditWithoutMode = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/family-surveys',
      token,
      body: {
        family_serial_number: 1,
        head_of_family_name: 'Hacked Head Name',
        is_draft: true
      }
    });
    assert(famEditWithoutMode.status === 409 && famEditWithoutMode.body.locked === true,
      'Individual family edit without editing mode blocked (409 locked)');

    // Modify with editing mode
    const famEditWithMode = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/family-surveys',
      token,
      body: {
        family_serial_number: 1,
        head_of_family_name: 'UPDATED: Shri Suresh Patil',
        total_family_members: 5,
        respondent_name: 'Suresh Patil',
        contact_number: '9876543201',
        village_name: v1,
        category: 'OBC',
        annual_income: 150000,
        ration_card_type: 'Orange',
        is_editing_submitted: true,
        is_draft: true
      }
    });
    assert(famEditWithMode.status === 200,
      'Individual family edit with is_editing_submitted: true succeeds');

    // Resubmit all families
    const famResubmit = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/family-surveys/submit-all',
      token,
      body: { is_final_submit: true, is_update_response: true }
    });
    assert(famResubmit.status === 200 && famResubmit.body.status === 'Submitted',
      'Resubmitted all families successfully with status "Submitted"');

    const famDb = await pool.query(`
      SELECT count(*) as family_count, head_of_family_name
      FROM ri_family_surveys
      WHERE student_id = $1 AND ri_batch_id = $2 AND family_serial_number = 1
      GROUP BY head_of_family_name
    `, [testStudent.student_id, testStudent.ri_batch_id]);
    assert(parseInt(famDb.rows[0].family_count, 10) === 1,
      'Family #1 count is exactly 1 (no duplicate rows)');
    assert(famDb.rows[0].head_of_family_name === 'UPDATED: Shri Suresh Patil',
      'Family #1 updated name correctly persisted');

    // =========================================================================
    // TEST 4: PROBLEM IDENTIFICATION & SMART SOLUTION (FORM VI)
    // =========================================================================
    console.log('\n--- [FORM 4] PROBLEM IDENTIFICATION & SMART SOLUTION (FORM VI) ---');
    const initialProbPayload = {
      status: 'Submitted',
      is_final_submit: true,
      school_name: 'School of Design',
      department_name: 'Product Design',
      degree_program: 'B.Des',
      village_visited: testStudent.village_name || 'Daund Test Village',
      students_participated: 4,
      team_leader_name: testStudent.student_name,
      total_team_members: 4,
      problem_title: 'Inadequate solar street lighting in internal wadis',
      is_aligned_with_sdg: 'Yes',
      is_related_to_degree: 'Yes',
      solution_offered: 'Smart low-cost solar LED fixtures with PIR motion sensors',
      helping_faculty_name: 'Prof. K. Sharma',
      helping_faculty_dept: 'School of Design',
      solution_is_practical_implementable: 'Yes',
      solution_is_practical_smart: 'Yes',
      committee_chairperson: 'Dr. Anand Joshi',
      presentation_date: '2026-10-18',
      committee_remarks: 'Approved with appreciation',
      sarpanch_informed_person: 'Sarpanch Smt. Rekha More',
      sarpanch_informed_details: 'Informed in Gram Sabha meeting on 15th Oct',
      ri_cell_submission_details: 'Submitted presentation copy to RI Cell Daund office',
      assignment_link: 'https://mitwpu.edu.in/assignments/ri_form_vi_report.pdf'
    };

    const probSubmitRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/problem-identification',
      token,
      body: initialProbPayload
    });

    if (probSubmitRes.status !== 200) {
      console.error('probSubmitRes error:', probSubmitRes.status, probSubmitRes.body);
    }
    assert(probSubmitRes.status === 200 && probSubmitRes.body.status === 'Submitted',
      'Problem Identification (Form VI) submitted with status "Submitted"');

    // Block draft downgrade
    const probDraftAttempt = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/problem-identification',
      token,
      body: { ...initialProbPayload, status: 'Draft', is_final_submit: false }
    });
    assert(probDraftAttempt.status === 409 && probDraftAttempt.body.locked === true,
      'Draft downgrade blocked on submitted Form VI');

    // Edit response
    const probUpdateRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/problem-identification',
      token,
      body: {
        ...initialProbPayload,
        is_update_response: true,
        solution_offered: 'UPDATED: Hybrid solar-microgrid with automatic battery health monitoring and local technician training'
      }
    });
    assert(probUpdateRes.status === 200 && probUpdateRes.body.status === 'Submitted',
      'Edit Response successfully updated and resubmitted Form VI');

    const probDb = await pool.query(`
      SELECT count(*) as count, solution_offered
      FROM ri_problem_identifications
      WHERE student_id = $1 AND ri_batch_id = $2
      GROUP BY solution_offered
    `, [testStudent.student_id, testStudent.ri_batch_id]);
    assert(parseInt(probDb.rows[0].count, 10) === 1,
      'ri_problem_identifications record count is exactly 1 (no duplicates)');
    assert(probDb.rows[0].solution_offered.includes('UPDATED: Hybrid solar-microgrid'),
      'Updated solution description persisted correctly');

    // =========================================================================
    // TEST 5: RI FEEDBACK FORM (FORM VIII)
    // =========================================================================
    console.log('\n--- [FORM 5] RI FEEDBACK FORM (FORM VIII) ---');
    const initialFeedbackPayload = {
      status: 'Submitted',
      is_final_submit: true,
      rating_institutional_visits: 5,
      rating_household_surveys: 4,
      rating_community_project: 5,
      rating_debrief_school_activity: 5,
      best_practices_observed: 'Community water conservation through soak pits and tree bunding',
      other_activities_implemented: 'Blood donation awareness drive',
      suggestions_to_improve_program: 'Provide bilingual survey sheets for local Marathi speakers',
      overall_rating: 5,
      mentorship_rating: 5,
      village_reception_rating: 5,
      logistics_rating: 4,
      willing_for_followup: true
    };

    const fbSubmitRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/feedback',
      token,
      body: initialFeedbackPayload
    });
    assert(fbSubmitRes.status === 200 && fbSubmitRes.body.status === 'Submitted',
      'RI Feedback Form (Form VIII) submitted with status "Submitted"');

    // Block draft downgrade
    const fbDraftAttempt = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/feedback',
      token,
      body: { ...initialFeedbackPayload, status: 'Draft', is_final_submit: false }
    });
    assert(fbDraftAttempt.status === 409 && fbDraftAttempt.body.locked === true,
      'Draft downgrade blocked on submitted Form VIII');

    // Edit response
    const fbUpdateRes = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/feedback',
      token,
      body: {
        ...initialFeedbackPayload,
        is_update_response: true,
        best_practices_observed: 'UPDATED: Highly active Women Bachat Gat running automated millet processing mill'
      }
    });
    assert(fbUpdateRes.status === 200 && fbUpdateRes.body.status === 'Submitted',
      'Edit Response successfully updated and resubmitted Form VIII');

    const fbDb = await pool.query(`
      SELECT count(*) as count, best_practices_observed
      FROM ri_student_feedbacks
      WHERE student_id = $1 AND ri_batch_id = $2
      GROUP BY best_practices_observed
    `, [testStudent.student_id, testStudent.ri_batch_id]);
    assert(parseInt(fbDb.rows[0].count, 10) === 1,
      'ri_student_feedbacks record count is exactly 1 (no duplicates)');
    assert(fbDb.rows[0].best_practices_observed.includes('UPDATED: Highly active Women Bachat Gat'),
      'Updated feedback entries persisted correctly');

    // =========================================================================
    // TEST 6: UNDERTAKING FORM EXCLUSION VERIFICATION
    // =========================================================================
    console.log('\n--- [EXCLUSION CHECK] UNDERTAKING FORM (FORM IA) ---');
    // Ensure undertaking is submitted
    await apiRequest({
      method: 'POST',
      path: '/api/ri/student/undertaking',
      token,
      body: {
        emergencyContactName: 'Father Name',
        emergencyContactRelation: 'Father',
        emergencyContactMobile: '9876543210',
        bloodGroup: 'O+',
        signedName: testStudent.student_name,
        consentFieldWork: true,
        consentCodeOfConduct: true,
        consentMedicalEmergency: true,
        consentPhotoVideo: true
      }
    });

    // Attempt re-submitting / editing undertaking -> must be blocked
    const underResubmitAttempt = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/undertaking',
      token,
      body: {
        emergencyContactName: 'Changed Contact Name',
        emergencyContactRelation: 'Mother',
        emergencyContactMobile: '9876543211',
        signedName: testStudent.student_name
      }
    });
    assert(underResubmitAttempt.status === 400 && underResubmitAttempt.body.message.includes('already been submitted'),
      'Undertaking Form is strictly locked against re-submission and edits (status 400)');

    // =========================================================================
    // TEST 7: SECURITY & CROSS-STUDENT AUTHORIZATION
    // =========================================================================
    console.log('\n--- [SECURITY & AUTHORIZATION] CROSS-STUDENT ISOLATION ---');
    if (secondStudent) {
      const token2 = jwt.sign(
        { id: secondStudent.student_id, email: secondStudent.email, role: 'student' },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      // Student 2 attempts to update Student 1's daily activity report by injecting Student 1's ID
      const crossStudentDar = await apiRequest({
        method: 'POST',
        path: '/api/ri/student/forms/daily-activity-report',
        token: token2,
        body: {
          student_id: testStudent.student_id, // attempted override
          is_update_response: true,
          status: 'Submitted',
          seven_day_plan_improvements: 'MALICIOUS OVERWRITE'
        }
      });

      // Verify Student 1's database record was completely untouched by Student 2
      const s1DarCheck = await pool.query(`
        SELECT seven_day_plan_improvements
        FROM ri_daily_activity_reports
        WHERE student_id = $1 AND ri_batch_id = $2
      `, [testStudent.student_id, testStudent.ri_batch_id]);
      assert(!s1DarCheck.rows[0].seven_day_plan_improvements.includes('MALICIOUS OVERWRITE'),
        'Cross-student payload injection strictly prevented: server relies exclusively on authenticated JWT identity');
    }

    // =========================================================================
    // TEST 8: FACULTY EVALUATION & REVIEW LOCK ENFORCEMENT
    // =========================================================================
    console.log('\n--- [EVALUATION LOCK] FACULTY REVIEW LOCK ---');
    // Simulate faculty marking student form as 'Reviewed'
    await pool.query(`
      UPDATE ri_student_forms
      SET status = 'Reviewed'
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'DAILY_ACTIVITY_REPORT'
    `, [testStudent.student_id, testStudent.ri_batch_id]);

    const darReviewedAttempt = await apiRequest({
      method: 'POST',
      path: '/api/ri/student/forms/daily-activity-report',
      token,
      body: {
        is_update_response: true,
        status: 'Submitted',
        seven_day_plan_improvements: 'Edit after review'
      }
    });
    assert(darReviewedAttempt.status === 409 && darReviewedAttempt.body.locked === true,
      'When faculty has finalized/reviewed the form ("Reviewed"), all edits are strictly blocked');

    // Reset status back to 'Submitted' for test hygiene
    await pool.query(`
      UPDATE ri_student_forms
      SET status = 'Submitted'
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'DAILY_ACTIVITY_REPORT'
    `, [testStudent.student_id, testStudent.ri_batch_id]);

    console.log('\n========================================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('========================================================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED WITH ERROR:', err);
    process.exit(1);
  }
}

run();
