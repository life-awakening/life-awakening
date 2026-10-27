/**
 * Test Suite: Institutional Visit Observations (ANNEX G-6, FORM IV) & Feedback Form Question 6
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../config/db');

async function runTests() {
  console.log('=== STARTING FORM IV & FEEDBACK FORM QUESTION 6 TEST SUITE ===\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
    } else {
      console.error(`  FAIL: ${message}`);
      failures++;
    }
  }

  const client = await pool.connect();
  try {
    // 1. Check database column observation_data in ri_institutional_visits
    const colRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ri_institutional_visits' AND column_name = 'observation_data'
    `);
    assert(colRes.rows.length > 0, 'observation_data column exists in ri_institutional_visits');
    assert(colRes.rows[0]?.data_type === 'jsonb', 'observation_data column is of type jsonb');

    // 2. Find a test student with batch assignment
    const stuRes = await client.query(`
      SELECT rbs.student_id, rbs.ri_batch_id, rbs.ri_panel_id, u.name, u.email
      FROM ri_batch_students rbs
      JOIN users u ON u.id = rbs.student_id
      LIMIT 1
    `);
    const student = stuRes.rows[0];
    assert(Boolean(student), `Found active test student ${student?.student_id}`);

    const studentId = student.student_id;
    const batchId = student.ri_batch_id;
    const panelId = student.ri_panel_id;

    // 3. Test Form VIII (Feedback Form) - Question 6 compulsory check
    console.log('\n--- Testing RI Feedback Form Question 6 Compulsory Rule ---');
    const { saveStudentFeedback } = require('../controllers/riStudentController');

    // Mock Express req, res
    function mockReqRes(body, user) {
      const req = { body, user: user || { id: studentId, email: student.email, name: student.name } };
      let statusCode = 200;
      let responseData = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseData = data;
          return this;
        }
      };
      return { req, res, getStatus: () => statusCode, getData: () => responseData };
    }

    // Attempt final submit without best_practices_observed
    const missingQ6 = mockReqRes({
      is_final_submit: true,
      rating_institutional_visits: 5,
      rating_household_surveys: 5,
      rating_community_project: 5,
      rating_debrief_school_activity: 5,
      best_practices_observed: ''
    });
    await saveStudentFeedback(missingQ6.req, missingQ6.res);
    assert(missingQ6.getStatus() === 400, 'Submitting Form VIII without Question 6 returns 400 Bad Request');
    assert(missingQ6.getData()?.message?.includes('Question 6'), 'Error message specifically flags Question 6 as compulsory');

    // Attempt final submit with best_practices_observed
    const validQ6 = mockReqRes({
      is_final_submit: true,
      rating_institutional_visits: 5,
      rating_household_surveys: 5,
      rating_community_project: 5,
      rating_debrief_school_activity: 5,
      best_practices_observed: 'Villagers practice community rain water harvesting and bio-gas generation.'
    });
    await saveStudentFeedback(validQ6.req, validQ6.res);
    assert(validQ6.getStatus() === 200, 'Submitting Form VIII with Question 6 succeeds with 200 OK');

    // 4. Test Form IV (Institutional Visit Observations)
    console.log('\n--- Testing Form IV (Institutional Visit Observations) All 9 Sections ---');
    const { saveInstitutionalVisits, getInstitutionalVisits } = require('../controllers/riStudentController');

    const sampleVisits = [
      {
        institution_type: 'Gram Panchayat Office',
        institution_name: 'Gram Panchayat Kasurdi',
        visit_date: '2026-10-12',
        official_contact_person: 'Shri D. Patil',
        official_designation: 'Gram Sevak',
        services_provided: 'Tax assessment, birth/death registration, village water distribution',
        observations: 'Office well maintained, solar powered, computerized 7/12 records counter active',
        challenges_identified: 'Delayed water pipeline repairs during summer months',
        recommendations: 'Install automated chlorine sensor in main water tank',
        has_electricity: true,
        has_drinking_water: true,
        has_computer_internet: true,
        has_separate_toilets: true
      },
      {
        institution_type: 'Zilla Parishad Primary / High School',
        institution_name: 'Z.P. School Kasurdi',
        visit_date: '2026-10-12',
        official_contact_person: 'Smt. S. Shinde',
        official_designation: 'Headmaster',
        services_provided: 'Primary education grades 1-7, Mid-day meal program',
        observations: 'Clean classrooms, functional library, active playground',
        challenges_identified: 'Lack of dedicated science laboratory equipment',
        recommendations: 'Sponsor STEM kit via university outreach project',
        has_electricity: true,
        has_drinking_water: true,
        has_computer_internet: false,
        has_separate_toilets: true
      }
    ];

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
        ss_9_special_scheme_details: 'Sant Gadge Baba Gram Swachhata Abhiyan - Won 1st prize at Taluka level with zero open defecation award.'
      }
    };

    // A. Save Draft
    console.log('\n--- Testing Save Draft Persistence ---');
    const draftMock = mockReqRes({
      visits: sampleVisits,
      form_sections: sampleFormSections,
      status: 'Draft'
    });
    await saveInstitutionalVisits(draftMock.req, draftMock.res);
    assert(draftMock.getStatus() === 200, 'Save Draft returns 200 OK');

    // B. Reopen and Get Institutional Visits
    console.log('\n--- Testing Reopening & Data Restoration ---');
    const getMock = mockReqRes({});
    await getInstitutionalVisits(getMock.req, getMock.res);
    assert(getMock.getStatus() === 200, 'getInstitutionalVisits returns 200 OK');
    const getData = getMock.getData();
    assert(getData?.visits?.length === 2, `Retrieved exactly 2 visits (Actual: ${getData?.visits?.length})`);
    assert(getData?.visits[0]?.institution_name === 'Gram Panchayat Kasurdi', 'Restored Institution 1 name correctly');
    assert(Boolean(getData?.form_sections), 'Form sections restored on getInstitutionalVisits');
    assert(getData?.form_sections?.section_1_village_info?.v_1_1_village_name === 'Kasurdi', 'Restored Village Name Kasurdi');
    assert(getData?.form_sections?.section_2_gram_panchayat?.gp_2_2_water_supply === '1) Tap water - public', 'Restored Gram Panchayat water supply');
    assert(getData?.form_sections?.section_9_special_scheme?.ss_9_special_scheme_details?.includes('Sant Gadge Baba'), 'Restored Section 9 special schemes');

    // C. Final Submit with validation
    console.log('\n--- Testing Final Submit Validation ---');
    // Incomplete submission missing section 9
    const incompleteSections = JSON.parse(JSON.stringify(sampleFormSections));
    incompleteSections.section_9_special_scheme.ss_9_special_scheme_details = '';

    const invalidSubmitMock = mockReqRes({
      visits: sampleVisits,
      form_sections: incompleteSections,
      is_final_submit: true
    });
    await saveInstitutionalVisits(invalidSubmitMock.req, invalidSubmitMock.res);
    assert(invalidSubmitMock.getStatus() === 400, 'Final submit with missing section 9 returns 400');

    // Valid Final Submit
    const validSubmitMock = mockReqRes({
      visits: sampleVisits,
      form_sections: sampleFormSections,
      is_final_submit: true
    });
    await saveInstitutionalVisits(validSubmitMock.req, validSubmitMock.res);
    assert(validSubmitMock.getStatus() === 200, 'Final submit with all 9 sections returns 200 OK');

    // Check status in database
    const formRow = await client.query(`
      SELECT status, progress_percent, submission_timestamp 
      FROM ri_student_forms 
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'INSTITUTIONAL_VISIT'
    `, [studentId, batchId]);
    assert(formRow.rows[0]?.status === 'Submitted', 'Database status is Submitted');
    assert(Number(formRow.rows[0]?.progress_percent) === 100, 'Database progress_percent is 100%');
    assert(Boolean(formRow.rows[0]?.submission_timestamp), 'Database submission_timestamp is set');

    // D. Check Faculty Workspace query returns full data
    console.log('\n--- Testing Faculty Workspace Data Retrieval ---');
    const facultyWorkspaceVisits = await client.query(`
      SELECT * FROM ri_institutional_visits WHERE student_id = $1 AND ri_batch_id = $2 ORDER BY id ASC
    `, [studentId, batchId]);
    assert(facultyWorkspaceVisits.rows.length === 2, 'Faculty workspace query retrieves all 2 institutions');
    assert(Boolean(facultyWorkspaceVisits.rows[0]?.observation_data?.section_1_village_info), 'Faculty record contains observation_data.section_1_village_info');
    assert(Boolean(facultyWorkspaceVisits.rows[0]?.additional_details?.form_sections), 'Faculty record contains additional_details.form_sections');

  } catch (err) {
    console.error('Test Suite encountered unhandled error:', err);
    failures++;
  } finally {
    client.release();
    console.log(`\n=== TEST SUITE COMPLETED WITH ${failures} FAILURE(S) ===\n`);
    process.exit(failures > 0 ? 1 : 0);
  }
}

runTests();
