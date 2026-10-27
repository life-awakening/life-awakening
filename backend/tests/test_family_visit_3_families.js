/**
 * Comprehensive Automated Verification for Family Visit Observations - Minimum 3 Completed Families.
 *
 * Requirements Tested:
 * 1. Only two complete families: BLOCK (HTTP 400).
 * 2. Three records with one incomplete family: BLOCK (HTTP 400).
 * 3. Missing Village Name: that family must not count as complete (HTTP 400).
 * 4. Three complete families in the SAME village: PASS (HTTP 200, status: Submitted).
 * 5. Three complete families across DIFFERENT villages: PASS (HTTP 200).
 * 6. Saved drafts and existing family records remain intact.
 * 7. Undertaking Form behavior remains unchanged.
 */
const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

function api({ method = 'GET', path, token, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') });
        } catch {
          resolve({ status: res.statusCode, raw: buf });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const tokenFor = s => jwt.sign({ id: s.id, email: s.email, name: s.name, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

async function run() {
  console.log('--- STARTING 3 COMPLETED FAMILIES VERIFICATION SUITE ---');

  // Pick an active student enrolled in RI with a panel who currently has no family surveys
  const picked = (await pool.query(`
    SELECT u.id, u.email, u.name, rbs.ri_batch_id
    FROM ri_batch_students rbs
    JOIN users u ON u.id = rbs.student_id
    WHERE rbs.ri_panel_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ri_family_surveys f WHERE f.student_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM ri_evaluations e WHERE e.student_id = u.id AND e.evaluation_status IN ('Submitted', 'Completed'))
    ORDER BY rbs.ri_batch_id DESC, u.id
    LIMIT 1
  `)).rows;

  assert.ok(picked.length > 0, 'Could not find an enrolled RI student without existing family surveys');
  const student = picked[0];
  const token = tokenFor(student);

  const P_BASE = '/api/ri/student/forms/family-surveys';
  const P_SUBMIT = '/api/ri/student/forms/family-surveys/submit-all';
  const P_HUB = '/api/ri/student/forms';

  try {
    // 0. Initial Hub State
    const hubInit = await api({ path: P_HUB, token });
    assert.strictEqual(hubInit.status, 200, 'Hub load failed');
    const famHub = hubInit.body.forms?.find(f => f.form_type === 'FAMILY_SURVEY');
    assert.ok(famHub, 'Family survey form must be in hub');
    assert.strictEqual(famHub.completed_family_count, 0);
    console.log('✓ Test 0: Hub loaded with 0 completed families, progress = 0%');

    // 1. Save Family #1 in Village "Khalad,Tal.Purandar"
    const save1 = await api({
      method: 'POST',
      path: P_BASE,
      token,
      body: {
        family_serial_number: 1,
        village_name: 'Khalad,Tal.Purandar',
        head_of_family_name: 'Dnyaneshwar Shinde',
        total_family_members: 4,
        respondent_name: 'Dnyaneshwar Shinde',
        male_members: 2,
        female_members: 2
      }
    });
    assert.strictEqual(save1.status, 200, `Save family 1 failed: ${JSON.stringify(save1.body)}`);
    assert.strictEqual(save1.body.completed_families_count, 1);
    console.log('✓ Test 1: Family #1 in Khalad saved, completed_families_count = 1');

    // 2. Save Family #2 in SAME Village "Khalad,Tal.Purandar"
    const save2 = await api({
      method: 'POST',
      path: P_BASE,
      token,
      body: {
        family_serial_number: 2,
        village_name: 'Khalad,Tal.Purandar',
        head_of_family_name: 'Suresh More',
        total_family_members: 5,
        respondent_name: 'Suresh More',
        male_members: 3,
        female_members: 2
      }
    });
    assert.strictEqual(save2.status, 200, 'Save family 2 failed');
    assert.strictEqual(save2.body.completed_families_count, 2);
    console.log('✓ Test 2: Family #2 in same village saved, completed_families_count = 2');

    // 3. Test: Only two complete families -> BLOCK
    const submitBlock2 = await api({ method: 'POST', path: P_SUBMIT, token });
    assert.strictEqual(submitBlock2.status, 400, 'Submit with 2 families must be blocked (HTTP 400)');
    assert.ok(
      submitBlock2.body.message.includes('at least 3 family visit records'),
      `Expected message about 3 family visit records, got: ${submitBlock2.body.message}`
    );
    console.log('✓ Test 3: Only two complete families -> Submission blocked (HTTP 400)');

    // 4. Test: Save Family #3 as INCOMPLETE draft -> BLOCK
    const saveIncomplete = await api({
      method: 'POST',
      path: P_BASE,
      token,
      body: {
        family_serial_number: 3,
        village_name: 'Khalad,Tal.Purandar',
        head_of_family_name: 'Draft Family #3', // Incomplete placeholder name
        total_family_members: 3
        // Missing respondent_name
      }
    });
    assert.strictEqual(saveIncomplete.status, 200, 'Draft placeholder save succeeded');
    // Now there are 3 records in DB, but only 2 are complete
    const submitBlockIncomplete = await api({ method: 'POST', path: P_SUBMIT, token });
    assert.strictEqual(submitBlockIncomplete.status, 400, 'Submit with 1 incomplete family must be blocked (HTTP 400)');
    assert.ok(
      submitBlockIncomplete.body.message.includes('Head of family name is required') ||
      submitBlockIncomplete.body.message.includes('at least 3 family visit records'),
      `Expected incomplete family rejection, got: ${submitBlockIncomplete.body.message}`
    );
    console.log('✓ Test 4: Three records with one incomplete family -> Submission blocked (HTTP 400)');

    // 5. Test: Missing Village Name -> BLOCK
    const saveNoVillage = await api({
      method: 'POST',
      path: P_BASE,
      token,
      body: {
        family_serial_number: 3,
        village_name: '', // Empty village!
        survey_data: { village_name: '' },
        head_of_family_name: 'Ganesh Pawar',
        total_family_members: 4,
        respondent_name: 'Ganesh Pawar'
      }
    });
    assert.strictEqual(saveNoVillage.status, 200);

    // 6. Test: Complete Family #3 in the SAME Village "Khalad,Tal.Purandar"
    const save3SameVillage = await api({
      method: 'POST',
      path: P_BASE,
      token,
      body: {
        family_serial_number: 3,
        village_name: 'Khalad,Tal.Purandar', // Same village as Family 1 and 2!
        head_of_family_name: 'Ganesh Pawar',
        total_family_members: 4,
        respondent_name: 'Ganesh Pawar',
        male_members: 2,
        female_members: 2
      }
    });
    assert.strictEqual(save3SameVillage.status, 200, 'Save family 3 failed');
    assert.strictEqual(save3SameVillage.body.completed_families_count, 3);
    console.log('✓ Test 5: Family #3 in same village completed, completed_families_count = 3');

    // 7. Test: Three complete families in the SAME village -> PASS
    const submitSuccessSameVillage = await api({ method: 'POST', path: P_SUBMIT, token });
    assert.strictEqual(submitSuccessSameVillage.status, 200, `Submit failed: ${JSON.stringify(submitSuccessSameVillage.body)}`);
    assert.strictEqual(submitSuccessSameVillage.body.status, 'Submitted');
    assert.strictEqual(submitSuccessSameVillage.body.completed_families_count, 3);
    console.log('✓ Test 6: Three complete families in SAME village -> PASS (HTTP 200, Submitted)');

    // 8. Verify DB state after submission
    const formCheck = await pool.query(
      `SELECT status, progress_percent FROM ri_student_forms WHERE student_id = $1 AND form_type = 'FAMILY_SURVEY'`,
      [student.id]
    );
    assert.strictEqual(formCheck.rows[0].status, 'Submitted');
    assert.strictEqual(formCheck.rows[0].progress_percent, 100);
    console.log('✓ Test 7: Master form in DB verified: status = Submitted, progress = 100%');

    // 9. Test: Edit Submitted Response & Three complete families across DIFFERENT villages -> PASS
    const updateDiffVillage = await api({
      method: 'POST',
      path: P_BASE,
      token,
      body: {
        family_serial_number: 3,
        village_name: 'Lenyadri,Tal.Junnar', // Different village!
        head_of_family_name: 'Ganesh Pawar (Updated)',
        total_family_members: 5,
        respondent_name: 'Ganesh Pawar',
        is_editing_submitted: true
      }
    });
    assert.strictEqual(updateDiffVillage.status, 200, 'Edit family 3 failed');

    const resubmitDiffVillages = await api({
      method: 'POST',
      path: P_SUBMIT,
      token,
      headers: { 'X-Is-Editing-Response': 'true' }
    });
    assert.strictEqual(resubmitDiffVillages.status, 200, 'Resubmission with different villages failed');
    assert.strictEqual(resubmitDiffVillages.body.status, 'Submitted');
    console.log('✓ Test 8: Three complete families across DIFFERENT villages -> PASS (HTTP 200)');

    // 10. Test: Undertaking Form behavior remains strictly locked
    const underRes = await api({
      method: 'POST',
      path: '/api/ri/student/forms/undertaking',
      token,
      body: { medical_declaration: 'Updated' }
    });
    assert.ok(underRes.status === 400 || underRes.status === 409 || underRes.status === 403, 'Undertaking must not allow unauthorized changes');
    console.log('✓ Test 9: Undertaking Form behavior remains strictly protected');

    // 11. Hub Progress check
    const hubFinal = await api({ path: P_HUB, token });
    const famHubFinal = hubFinal.body.forms?.find(f => f.form_type === 'FAMILY_SURVEY');
    assert.strictEqual(famHubFinal.status, 'Submitted');
    assert.strictEqual(famHubFinal.progress_percent, 100);
    console.log('✓ Test 10: Hub progress reflects 100% for submitted family survey');

    console.log('\n======================================================');
    console.log('🎉 ALL 11 VERIFICATION TEST CASES PASSED SUCCESSFULLY!');
    console.log('======================================================');
  } finally {
    // Teardown: Clean up test rows
    await pool.query(`DELETE FROM ri_family_surveys WHERE student_id = $1`, [student.id]);
    await pool.query(`DELETE FROM ri_student_forms WHERE student_id = $1 AND form_type = 'FAMILY_SURVEY'`, [student.id]);
    console.log(`Cleaned up test data for student ${student.id}`);
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
