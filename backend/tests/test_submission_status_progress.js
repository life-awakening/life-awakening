/**
 * Automated Verification Test for RI Form Submission Statuses & Progress Percentages
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/db');

async function runTests() {
  console.log('=== STARTING SUBMISSION STATUS & PROGRESS ACCURACY AUDIT ===\n');
  let failures = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  PASS: ${testName}`);
    } else {
      console.error(`  FAIL: ${testName}`);
      failures++;
    }
  }

  try {
    // 1. Audit active student records in the database
    const studentRes = await pool.query(`
      SELECT student_id, ri_batch_id, ri_panel_id 
      FROM ri_batch_students 
      WHERE student_id = 407678
      LIMIT 1
    `);
    assert(studentRes.rowCount > 0, 'Found test student 407678 enrolled in batch');
    const { student_id, ri_batch_id, ri_panel_id } = studentRes.rows[0];

    // 2. Test Family Survey status & progress in DB
    const famFormRes = await pool.query(`
      SELECT status, progress_percent, submission_timestamp 
      FROM ri_student_forms 
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'FAMILY_SURVEY'
    `, [student_id, ri_batch_id]);
    
    assert(famFormRes.rowCount > 0, 'FAMILY_SURVEY record exists in ri_student_forms');
    const famForm = famFormRes.rows[0];
    assert(famForm.status === 'Submitted', 'FAMILY_SURVEY status is Submitted');
    assert(famForm.progress_percent === 100, `FAMILY_SURVEY progress is 100% (Actual: ${famForm.progress_percent}%)`);
    assert(famForm.submission_timestamp != null, 'FAMILY_SURVEY has valid submission_timestamp');

    // 3. Test Institutional Visit (Draft) status & progress in DB
    const instFormRes = await pool.query(`
      SELECT status, progress_percent, submission_timestamp 
      FROM ri_student_forms 
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'INSTITUTIONAL_VISIT'
    `, [student_id, ri_batch_id]);

    assert(instFormRes.rowCount > 0, 'INSTITUTIONAL_VISIT record exists in ri_student_forms');
    const instForm = instFormRes.rows[0];
    assert(instForm.status === 'Draft', 'INSTITUTIONAL_VISIT status is Draft (not Submitted)');
    assert(instForm.progress_percent < 100, `INSTITUTIONAL_VISIT progress is < 100% in draft (Actual: ${instForm.progress_percent}%)`);
    assert(instForm.submission_timestamp === null, 'INSTITUTIONAL_VISIT draft has null submission_timestamp');

    // 4. Test Daily Activity Report (Submitted) status & progress in DB
    const dailyFormRes = await pool.query(`
      SELECT status, progress_percent, submission_timestamp 
      FROM ri_student_forms 
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'DAILY_ACTIVITY_REPORT'
    `, [student_id, ri_batch_id]);

    assert(dailyFormRes.rowCount > 0, 'DAILY_ACTIVITY_REPORT record exists in ri_student_forms');
    const dailyForm = dailyFormRes.rows[0];
    assert(dailyForm.status === 'Submitted', 'DAILY_ACTIVITY_REPORT status is Submitted');
    assert(dailyForm.progress_percent === 100, `DAILY_ACTIVITY_REPORT progress is 100% (Actual: ${dailyForm.progress_percent}%)`);

    // 5. Simulate getPanelSubmissions query
    const panelSubmissionsRes = await pool.query(`
      SELECT 
        u.id as student_id,
        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'UNDERTAKING' LIMIT 1),
          CASE WHEN EXISTS (SELECT 1 FROM ri_undertakings ru WHERE ru.student_id = u.id AND ru.status = 'Submitted') OR u.undertaking_submitted = true THEN 'Submitted'
               WHEN EXISTS (SELECT 1 FROM ri_undertakings ru WHERE ru.student_id = u.id) THEN 'Draft'
               ELSE 'Not Started' END
        ) as undertaking_status,
        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type IN ('DAILY_ACTIVITY', 'DAILY_ACTIVITY_REPORT', 'FORM_IIIB') ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_daily_activity_reports dar WHERE dar.student_id = u.id AND dar.ri_batch_id = $1 ORDER BY dar.id DESC LIMIT 1),
          'Not Started'
        ) as daily_activity_status,
        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'INSTITUTIONAL_VISIT' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_institutional_visits iv WHERE iv.student_id = u.id AND iv.ri_batch_id = $1 ORDER BY (CASE WHEN iv.status = 'Submitted' THEN 1 ELSE 2 END), iv.id DESC LIMIT 1),
          'Not Started'
        ) as institutional_status,
        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'FAMILY_SURVEY' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_family_surveys fs WHERE fs.student_id = u.id AND fs.ri_batch_id = $1 ORDER BY (CASE WHEN fs.status = 'Submitted' THEN 1 ELSE 2 END), fs.id DESC LIMIT 1),
          'Not Started'
        ) as family_status,
        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'PROBLEM_IDENTIFICATION' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_problem_identifications pi WHERE pi.student_id = u.id AND pi.ri_batch_id = $1 ORDER BY pi.id DESC LIMIT 1),
          'Not Started'
        ) as problem_status,
        COALESCE(
          (SELECT status FROM ri_student_forms sf WHERE sf.student_id = u.id AND sf.ri_batch_id = $1 AND sf.form_type = 'PREPARATORY_CHECKLIST' ORDER BY sf.id DESC LIMIT 1),
          (SELECT status FROM ri_preparatory_checklists pc WHERE pc.student_id = u.id AND pc.ri_batch_id = $1 ORDER BY pc.id DESC LIMIT 1),
          'Not Started'
        ) as checklist_status
      FROM users u WHERE u.id = $2
    `, [ri_batch_id, student_id]);

    const panelRow = panelSubmissionsRes.rows[0];
    assert(panelRow.family_status === 'Submitted', `Panel view: family_status is 'Submitted' (Actual: ${panelRow.family_status})`);
    assert(panelRow.institutional_status === 'Draft', `Panel view: institutional_status is 'Draft' (Actual: ${panelRow.institutional_status})`);
    assert(panelRow.problem_status === 'Draft', `Panel view: draft problem_status is 'Draft' (Actual: ${panelRow.problem_status})`);
    assert(panelRow.checklist_status === 'Not Started', `Panel view: unstarted checklist_status is 'Not Started' (Actual: ${panelRow.checklist_status})`);
    assert(panelRow.undertaking_status === 'Submitted', `Panel view: user undertaking is 'Submitted' (Actual: ${panelRow.undertaking_status})`);

    // 6. Test frontend calculation simulation
    console.log('\n--- Simulating Frontend Progress & Status Logic ---');
    const mockFormsSummary = [
      { form_type: 'FAMILY_SURVEY', status: 'Submitted', progress_percent: 100 },
      { form_type: 'INSTITUTIONAL_VISIT', status: 'Draft', progress_percent: 45 },
      { form_type: 'DAILY_ACTIVITY_REPORT', status: 'Submitted', progress_percent: 100 },
      { form_type: 'STUDENT_FEEDBACK', status: 'Draft', progress_percent: 50 },
      { form_type: 'UNDERTAKING', status: 'Not Started', progress_percent: 0 },
      { form_type: 'PROBLEM_IDENTIFICATION', status: 'Not Started', progress_percent: 0 },
      { form_type: 'PREPARATORY_CHECKLIST', status: 'Not Started', progress_percent: 0 }
    ];

    function simulateGetFormMeta(formKey, formsSummary, childData) {
      const typeKeyMap = {
        undertaking: ['UNDERTAKING'],
        daily_activity: ['DAILY_ACTIVITY_REPORT', 'DAILY_ACTIVITY'],
        institutional: ['INSTITUTIONAL_VISIT'],
        family: ['FAMILY_SURVEY'],
        problem: ['PROBLEM_IDENTIFICATION'],
        feedback: ['STUDENT_FEEDBACK'],
        checklist: ['PREPARATORY_CHECKLIST']
      };
      const keys = typeKeyMap[formKey] || [];
      const sf = formsSummary.find(f => keys.includes(f.form_type));
      let status = sf?.status || 'Not Started';
      const submitted = status === 'Submitted' || status === 'Reviewed';
      let progress = 0;
      if (submitted) {
        progress = 100;
      } else if (status === 'Draft') {
        progress = Math.min(95, Math.max(10, sf?.progress_percent || 50));
      } else {
        progress = 0;
      }
      return { status, submitted, progress };
    }

    const famMeta = simulateGetFormMeta('family', mockFormsSummary);
    assert(famMeta.submitted === true, 'Frontend simulation: Family survey submitted is true');
    assert(famMeta.progress === 100, `Frontend simulation: Family survey progress is exactly 100% (Actual: ${famMeta.progress}%)`);

    const instMeta = simulateGetFormMeta('institutional', mockFormsSummary);
    assert(instMeta.submitted === false, 'Frontend simulation: Draft institutional visit submitted is FALSE');
    assert(instMeta.status === 'Draft', `Frontend simulation: Institutional visit status is 'Draft' (Actual: ${instMeta.status})`);
    assert(instMeta.progress === 45, `Frontend simulation: Institutional visit progress is accurate draft % (Actual: ${instMeta.progress}%)`);

    const probMeta = simulateGetFormMeta('problem', mockFormsSummary);
    assert(probMeta.submitted === false, 'Frontend simulation: Not started problem submitted is FALSE');
    assert(probMeta.status === 'Not Started', `Frontend simulation: Problem status is 'Not Started' (Actual: ${probMeta.status})`);
    assert(probMeta.progress === 0, `Frontend simulation: Problem progress is 0% (Actual: ${probMeta.progress}%)`);

    console.log(`\n=== ALL TESTS FINISHED WITH ${failures} FAILURES ===`);
  } catch (err) {
    console.error('Test execution error:', err);
    failures++;
  } finally {
    process.exit(failures > 0 ? 1 : 0);
  }
}

runTests();
