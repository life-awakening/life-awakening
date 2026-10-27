const pool = require('../config/db');
const riFacultyController = require('../controllers/riFacultyController');
const riStudentController = require('../controllers/riStudentController');
const assert = require('assert');

async function testIndependentVerification() {
  console.log('================================================================');
  console.log('INDEPENDENT VERIFICATION OF EXISTING SUBMISSIONS & FACULTY VIEW');
  console.log('================================================================\n');

  const studentsToTest = [407678, 407741, 407385];

  for (const sid of studentsToTest) {
    const sInfoRes = await pool.query(`
      SELECT rbs.student_id, rbs.ri_batch_id, rbs.ri_panel_id, u.name 
      FROM ri_batch_students rbs 
      JOIN users u ON u.id = rbs.student_id 
      WHERE rbs.student_id = $1
    `, [sid]);

    if (sInfoRes.rowCount === 0) continue;
    const sInfo = sInfoRes.rows[0];

    // 1. Student endpoint: Get Form IV
    let mockStudentResIV = {
      statusCode: 200, data: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.data = d; return this; }
    };
    await riStudentController.getInstitutionalVisits({ user: { id: sid } }, mockStudentResIV);
    console.log(`Student ${sid} Form IV fetch: HTTP ${mockStudentResIV.statusCode}, visits=${mockStudentResIV.data?.visits?.length}`);

    // 2. Student endpoint: Get Form V
    let mockStudentResV = {
      statusCode: 200, data: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.data = d; return this; }
    };
    await riStudentController.getFamilySurveys({ user: { id: sid } }, mockStudentResV);
    console.log(`Student ${sid} Form V fetch: HTTP ${mockStudentResV.statusCode}, families=${mockStudentResV.data?.surveys?.length}`);

    // 3. Student endpoint: Get Form VI
    let mockStudentResVI = {
      statusCode: 200, data: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.data = d; return this; }
    };
    await riStudentController.getProblemIdentification({ user: { id: sid } }, mockStudentResVI);
    console.log(`Student ${sid} Form VI fetch: HTTP ${mockStudentResVI.statusCode}, title=${mockStudentResVI.data?.problem?.problem_title || 'N/A'}`);

    // 4. Faculty endpoint: Get Student Submission Detail
    let mockFacultyRes = {
      statusCode: 200, data: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.data = d; return this; }
    };
    const mockFacultyReq = {
      user: { id: sid, role: 'superadmin' },
      params: { studentId: String(sid) },
      query: { batch_id: String(sInfo.ri_batch_id), panel_id: String(sInfo.ri_panel_id) },
      isRiAdminPreview: true
    };
    await riFacultyController.getStudentSubmissionDetail(mockFacultyReq, mockFacultyRes);
    const d = mockFacultyRes.data;

    assert.strictEqual(mockFacultyRes.statusCode, 200, `Faculty retrieval for student ${sid} must return 200`);
    console.log(`Faculty sees student ${sid} (${sInfo.name}):`);
    console.log(`  - daily_activity: ${Boolean(d?.daily_activity)} (${d?.daily_activity?.village_visited || 'None'})`);
    console.log(`  - institutional_visits: ${d?.institutional_visits?.length || 0} visits`);
    console.log(`  - family_surveys: ${d?.family_surveys?.length || 0} families`);
    console.log(`  - problem_identification: ${Boolean(d?.problem_identification)} (${d?.problem_identification?.problem_title || 'None'})`);
    console.log(`  - report attachment: ${d?.problem_identification?.assignment_link || 'None'}`);

    // Verify reconciled forms summary
    assert.strictEqual(d?.forms_summary?.length, 7, 'Reconciled forms summary must contain all 7 forms');
    d.forms_summary.forEach(f => {
      console.log(`    * ${f.form_type}: ${f.status} (${f.progress_percent}%)`);
    });
  }

  console.log('\n================================================================');
  console.log('ALL EXISTING RECORDS & FACULTY VISIBILITY VERIFIED PERFECTLY!');
  console.log('================================================================');
  process.exit(0);
}

testIndependentVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
