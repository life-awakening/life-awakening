const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');
const riController = require('../controllers/riController');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 RUNNING RI ADMIN SUBMISSIONS PAGE INTEGRATION & SAFETY TEST');
  console.log('================================================================\n');

  try {
    // 1. Verify an active or existing RI batch exists (prefer one with enrolled students)
    const batchRes = await pool.query(
      `SELECT rb.id, rb.name, COUNT(rbs.id)::int as student_count
       FROM ri_batches rb
       LEFT JOIN ri_batch_students rbs ON rb.id = rbs.ri_batch_id
       WHERE rb.status <> 'deleted'
       GROUP BY rb.id, rb.name
       ORDER BY student_count DESC, rb.id DESC
       LIMIT 1`
    );
    if (batchRes.rowCount === 0) {
      console.log('⚠️ No RI batch found to test. Skipping test.');
      return;
    }
    const testBatch = batchRes.rows[0];
    console.log(`✓ Testing with RI Batch: ${testBatch.name} (ID: ${testBatch.id})`);

    // 2. Test getAdminSubmissions controller with batch_id
    let submissionsResult = null;
    const req1 = {
      query: { batch_id: String(testBatch.id) }
    };
    const res1 = {
      json: (data) => { submissionsResult = data; },
      status: (code) => ({
        json: (err) => { throw new Error(`Controller returned status ${code}: ${JSON.stringify(err)}`); }
      })
    };

    await riController.getAdminSubmissions(req1, res1);

    if (!submissionsResult || !submissionsResult.success) {
      throw new Error('getAdminSubmissions failed to return success');
    }

    console.log('✓ getAdminSubmissions returned success = true');
    console.log(`✓ Total students returned: ${submissionsResult.students.length}`);
    console.log(`✓ Summary stats:`, submissionsResult.summary);

    if (submissionsResult.students.length > 0) {
      const s = submissionsResult.students[0];
      console.log(`✓ Validating student structure for "${s.student_name}":`);
      console.log(`  - Student Name: ${s.student_name}`);
      console.log(`  - PRN: ${s.prn}`);
      console.log(`  - Email: ${s.email}`);
      console.log(`  - Batch: ${s.batch_name}`);
      console.log(`  - Panel: ${s.panel_name}`);
      console.log(`  - Form IA (Undertaking): ${s.forms.undertaking.status} (submitted: ${s.forms.undertaking.is_submitted})`);
      console.log(`  - Form IIIB (Daily Activity): ${s.forms.daily_activity.status}`);
      console.log(`  - Form IV (Institutional Visit): ${s.forms.institutional.status}`);
      console.log(`  - Form V (Family Visit): ${s.forms.family.status}`);
      console.log(`  - Form VI (Problem & Solution): ${s.forms.problem.status}`);
      console.log(`  - Overall: ${s.overall_status} (${s.submitted_forms_count}/${s.total_forms_count})`);

      // Verify all required 5 forms are present in forms dictionary
      const requiredForms = ['undertaking', 'daily_activity', 'institutional', 'family', 'problem'];
      for (const f of requiredForms) {
        if (!s.forms[f]) {
          throw new Error(`Missing form ${f} in student.forms object`);
        }
      }
      console.log('✓ All 5 forms are properly defined on student object.');

      // 3. Test getAdminStudentSubmissionDetail for this student
      let studentDetailResult = null;
      const req2 = {
        params: { studentId: s.student_id },
        query: { batch_id: String(testBatch.id) }
      };
      const res2 = {
        json: (data) => { studentDetailResult = data; },
        status: (code) => ({
          json: (err) => { throw new Error(`Controller returned status ${code}: ${JSON.stringify(err)}`); }
        })
      };

      await riController.getAdminStudentSubmissionDetail(req2, res2);

      if (!studentDetailResult || !studentDetailResult.success) {
        throw new Error('getAdminStudentSubmissionDetail failed to return success');
      }

      console.log('✓ getAdminStudentSubmissionDetail returned success = true');
      console.log(`  - Undertaking submitted: ${studentDetailResult.undertaking.submitted}`);
      console.log(`  - Signed name: "${studentDetailResult.undertaking.user_undertaking?.signed_name}"`);
      console.log(`  - Daily activity report exists: ${Boolean(studentDetailResult.daily_activity_report)}`);
      console.log(`  - Institutional visits count: ${studentDetailResult.institutional_visits?.length}`);
      console.log(`  - Family surveys count: ${studentDetailResult.family_surveys?.length}`);
      console.log(`  - Problem statement exists: ${Boolean(studentDetailResult.problem_identification)}`);
    }

    // 4. Test status filter: 'submitted' and 'pending'
    let pendingResult = null;
    const req3 = {
      query: { batch_id: String(testBatch.id), status: 'pending' }
    };
    const res3 = {
      json: (data) => { pendingResult = data; },
      status: (code) => ({
        json: (err) => { throw new Error(`Status ${code}: ${JSON.stringify(err)}`); }
      })
    };
    await riController.getAdminSubmissions(req3, res3);
    console.log(`✓ Filter status='pending' returned ${pendingResult.students.length} students`);

    let submittedFilterResult = null;
    const req4 = {
      query: { batch_id: String(testBatch.id), status: 'submitted' }
    };
    const res4 = {
      json: (data) => { submittedFilterResult = data; },
      status: (code) => ({
        json: (err) => { throw new Error(`Status ${code}: ${JSON.stringify(err)}`); }
      })
    };
    await riController.getAdminSubmissions(req4, res4);
    console.log(`✓ Filter status='submitted' returned ${submittedFilterResult.students.length} students`);
    if (submittedFilterResult.students.length > 0) {
      const s0 = submittedFilterResult.students[0];
      console.log(`  - Student under 'submitted' filter: ${s0.student_name} (${s0.prn})`);
      console.log(`    undertakingSubmitted: ${s0.submission_status?.undertakingSubmitted}, iiibSubmitted: ${s0.submission_status?.iiibSubmitted}`);
      if (!s0.submission_status?.hasAnySubmitted) {
        throw new Error('Student in submitted filter does not have hasAnySubmitted=true');
      }
    }

    console.log('\n================================================================');
    console.log('✅ ALL RI ADMIN SUBMISSIONS INTEGRATION TESTS PASSED PERFECTLY!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTest();
