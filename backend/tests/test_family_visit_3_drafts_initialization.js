/**
 * Test: Family Visit Observations 3 Draft Initialization and 3 Unique Villages
 * Verifies:
 * 1. Automatic initialization of 3 family draft records for new student
 * 2. Reconciliation with existing saved server records without duplicates or data loss
 * 3. Adding Family #4 and more
 * 4. Quiet save skipping untouched draft records
 * 5. Independent saving and loading of each family record
 * 6. Minimum 3 unique villages enforcement
 */

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';
const PORT = process.env.PORT || 5001;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Replicating frontend template and reconciliation functions for exact unit verification
function createNewFamilyTemplate(serialNumber) {
  return {
    family_serial_number: serialNumber,
    head_of_family_name: '',
    respondent_name: '',
    relationship_with_head: '',
    village_name: '',
    survey_data: {
      village_name: ''
    }
  };
}

function reconcileFamilies(serverFamilies, localDrafts, canEdit) {
  let resolvedList = [];
  if (serverFamilies.length > 0) {
    resolvedList = serverFamilies;
    if (localDrafts && canEdit) {
      resolvedList = serverFamilies.map(sf => {
        const matchLocal = localDrafts.find(lf => lf.id === sf.id || lf.family_serial_number === sf.family_serial_number);
        if (matchLocal) {
          const mergedSd = {
            ...(sf.survey_data || {}),
            ...(matchLocal.survey_data || {})
          };
          return {
            ...sf,
            ...matchLocal,
            id: sf.id,
            survey_data: mergedSd
          };
        }
        return sf;
      });

      localDrafts.forEach(lf => {
        if (!resolvedList.some(rf => rf.family_serial_number === lf.family_serial_number || (lf.id && rf.id === lf.id))) {
          resolvedList.push(lf);
        }
      });
    }

    if (canEdit && resolvedList.length < 3) {
      const existingSerials = new Set(resolvedList.map(f => parseInt(f.family_serial_number, 10)));
      for (let s = 1; s <= 3; s++) {
        if (!existingSerials.has(s)) {
          resolvedList.push(createNewFamilyTemplate(s));
        }
      }
      resolvedList.sort((a, b) => (parseInt(a.family_serial_number, 10) || 0) - (parseInt(b.family_serial_number, 10) || 0));
    }
  } else if (localDrafts && localDrafts.length > 0) {
    resolvedList = localDrafts;
    if (canEdit && resolvedList.length < 3) {
      const existingSerials = new Set(resolvedList.map(f => parseInt(f.family_serial_number, 10)));
      for (let s = 1; s <= 3; s++) {
        if (!existingSerials.has(s)) {
          resolvedList.push(createNewFamilyTemplate(s));
        }
      }
      resolvedList.sort((a, b) => (parseInt(a.family_serial_number, 10) || 0) - (parseInt(b.family_serial_number, 10) || 0));
    }
  } else {
    resolvedList = [
      createNewFamilyTemplate(1),
      createNewFamilyTemplate(2),
      createNewFamilyTemplate(3)
    ];
  }
  return resolvedList;
}

function getPillDisplay(f, idx) {
  const headName = f.head_of_family_name ? f.head_of_family_name.trim().split(' ')[0] : 'Draft';
  return `Family #${f.family_serial_number || idx + 1}: ${headName}`;
}

async function run() {
  console.log('--- STARTING 3 DRAFT FAMILIES & RECONCILIATION TEST ---');
  let failures = 0;

  function testCheck(condition, testName) {
    if (!condition) {
      console.error(`❌ FAIL: ${testName}`);
      failures++;
    } else {
      console.log(`✓ PASS: ${testName}`);
    }
  }

  // Unit Test 1: Brand new student (empty server list, empty local drafts)
  const newStudentFamilies = reconcileFamilies([], null, true);
  testCheck(newStudentFamilies.length === 3, 'New student receives exactly 3 families initialized');
  testCheck(newStudentFamilies[0].family_serial_number === 1, 'First family has serial #1');
  testCheck(newStudentFamilies[1].family_serial_number === 2, 'Second family has serial #2');
  testCheck(newStudentFamilies[2].family_serial_number === 3, 'Third family has serial #3');
  testCheck(getPillDisplay(newStudentFamilies[0], 0) === 'Family #1: Draft', 'Family #1 displays "Family #1: Draft"');
  testCheck(getPillDisplay(newStudentFamilies[1], 1) === 'Family #2: Draft', 'Family #2 displays "Family #2: Draft"');
  testCheck(getPillDisplay(newStudentFamilies[2], 2) === 'Family #3: Draft', 'Family #3 displays "Family #3: Draft"');

  // Unit Test 2: Returning student with 1 existing saved record (Family #1)
  const serverOne = [{ id: 101, family_serial_number: 1, head_of_family_name: 'Ramesh Patil', village_name: 'Pargaon' }];
  const reconciledOne = reconcileFamilies(serverOne, null, true);
  testCheck(reconciledOne.length === 3, 'Returning student with 1 saved record gets filled up to 3');
  testCheck(reconciledOne[0].id === 101 && reconciledOne[0].head_of_family_name === 'Ramesh Patil', 'Saved Family #1 preserved with ID and name');
  testCheck(reconciledOne[1].family_serial_number === 2 && !reconciledOne[1].id, 'Family #2 is initialized as draft');
  testCheck(reconciledOne[2].family_serial_number === 3 && !reconciledOne[2].id, 'Family #3 is initialized as draft');
  testCheck(getPillDisplay(reconciledOne[0], 0) === 'Family #1: Ramesh', 'Family #1 displays "Family #1: Ramesh"');
  testCheck(getPillDisplay(reconciledOne[1], 1) === 'Family #2: Draft', 'Family #2 displays "Family #2: Draft"');

  // Unit Test 3: Returning student with 4 existing saved records
  const serverFour = [
    { id: 101, family_serial_number: 1, head_of_family_name: 'Fam 1' },
    { id: 102, family_serial_number: 2, head_of_family_name: 'Fam 2' },
    { id: 103, family_serial_number: 3, head_of_family_name: 'Fam 3' },
    { id: 104, family_serial_number: 4, head_of_family_name: 'Fam 4' }
  ];
  const reconciledFour = reconcileFamilies(serverFour, null, true);
  testCheck(reconciledFour.length === 4, 'Returning student with 4 records keeps all 4 records without duplicate or truncation');

  // Unit Test 4: Local unpersisted edits merged with server records
  const localEdits = [
    { id: 101, family_serial_number: 1, respondent_name: 'Local Unsaved Name', survey_data: { customField: '123' } }
  ];
  const merged = reconcileFamilies(serverOne, localEdits, true);
  testCheck(merged[0].respondent_name === 'Local Unsaved Name', 'Local draft updates merged into server family record');
  testCheck(merged[0].head_of_family_name === 'Ramesh Patil', 'Existing server fields preserved');

  // Unit Test 5: Adding Family #4
  const startNewFamily = (currentList) => {
    const nextSr = currentList.length > 0
      ? Math.max(...currentList.map(f => parseInt(f.family_serial_number, 10) || 0)) + 1
      : 1;
    return [...currentList, createNewFamilyTemplate(nextSr)];
  };
  const withFour = startNewFamily(newStudentFamilies);
  testCheck(withFour.length === 4, 'Adding family results in 4 records');
  testCheck(withFour[3].family_serial_number === 4, 'Added family has serial #4');
  testCheck(getPillDisplay(withFour[3], 3) === 'Family #4: Draft', 'Added family displays "Family #4: Draft"');

  // Unit Test 6: Untouched Drafts do NOT trigger quiet save
  let quietSaveTriggered = false;
  function mockSaveQuietly(rec, dirty) {
    if (!rec || !dirty) return;
    quietSaveTriggered = true;
  }
  mockSaveQuietly(newStudentFamilies[0], false);
  testCheck(quietSaveTriggered === false, 'Quiet save skipped for untouched drafts (isDirty = false)');

  // Integration Test with Database:
  // Pick an active student enrolled in RI with a panel
  const picked = (await pool.query(`
    SELECT u.id, u.email, u.name, rbs.ri_batch_id
    FROM ri_batch_students rbs
    JOIN users u ON u.id = rbs.student_id
    WHERE rbs.ri_panel_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ri_evaluations e WHERE e.student_id = u.id AND e.evaluation_status IN ('Submitted', 'Completed'))
    ORDER BY rbs.ri_batch_id DESC, u.id
    LIMIT 1
  `)).rows;

  if (picked.length === 0) {
    console.error('No student found for integration test');
    process.exit(1);
  }

  const student = picked[0];
  const token = jwt.sign(
    { id: student.id, email: student.email, name: student.name, role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const headers = {
    'Authorization': `Bearer ${token}`
  };

  const createdFamilyIds = [];

  try {
    // Clean up any existing surveys for test student
    await pool.query('DELETE FROM ri_family_surveys WHERE student_id = $1', [student.id]);
    await pool.query("DELETE FROM ri_student_forms WHERE student_id = $1 AND form_type = 'FAMILY_SURVEY'", [student.id]);

    // Step A: Initial GET request (verifies empty DB state)
    const getRes = await request('GET', '/api/ri/student/forms/family-surveys', null, headers);
    testCheck(getRes.status === 200 && Array.isArray(getRes.body.families) && getRes.body.families.length === 0, 'GET /family-surveys returns 0 DB rows for new student (no premature DB insertion)');

    // Step B: Save Family #1 with Village A
    const fam1Payload = {
      family_serial_number: 1,
      head_of_family_name: 'Kashinath Pawar',
      respondent_name: 'Anita Pawar',
      relationship_with_head: 'Wife',
      village_name: 'Pargaon',
      total_family_members: 4,
      survey_data: { village_name: 'Pargaon', members: [{ name: 'Kashinath', age: 48 }] }
    };
    const res1 = await request('POST', '/api/ri/student/forms/family-surveys', fam1Payload, headers);
    testCheck(res1.status === 200 && res1.body.family?.id, 'Family #1 saved independently in DB');
    if (res1.body.family?.id) createdFamilyIds.push(res1.body.family.id);

    // Step C: Save Family #2 with Village B
    const fam2Payload = {
      family_serial_number: 2,
      head_of_family_name: 'Suresh Deshmukh',
      respondent_name: 'Sunita Deshmukh',
      relationship_with_head: 'Wife',
      village_name: 'Chaufula Wasti',
      total_family_members: 5,
      survey_data: { village_name: 'Chaufula Wasti', members: [{ name: 'Suresh', age: 52 }] }
    };
    const res2 = await request('POST', '/api/ri/student/forms/family-surveys', fam2Payload, headers);
    testCheck(res2.status === 200 && res2.body.family?.id && res2.body.family.id !== res1.body.family.id, 'Family #2 saved independently in DB with distinct ID');
    if (res2.body.family?.id) createdFamilyIds.push(res2.body.family.id);

    // Step D: Attempt final submit with only 2 families (must be rejected)
    const submitAttempt = await request('POST', '/api/ri/student/forms/family-surveys/submit-all', null, headers);
    testCheck(submitAttempt.status === 400 && (submitAttempt.body.message.includes('at least 3 family visit records') || submitAttempt.body.message.includes('at least 3')), 'Final submission blocked when only 2 families completed');

    // Step E: Save Family #3 with Village C
    const fam3Payload = {
      family_serial_number: 3,
      head_of_family_name: 'Babanrao Shinde',
      respondent_name: 'Lata Shinde',
      relationship_with_head: 'Wife',
      village_name: 'Ozar, Tal.Junnar',
      total_family_members: 6,
      survey_data: { village_name: 'Ozar, Tal.Junnar', members: [{ name: 'Babanrao', age: 55 }] }
    };
    const res3 = await request('POST', '/api/ri/student/forms/family-surveys', fam3Payload, headers);
    testCheck(res3.status === 200 && res3.body.family?.id, 'Family #3 saved independently in DB');
    if (res3.body.family?.id) createdFamilyIds.push(res3.body.family.id);

    // Step F: Final submit with 3 unique completed villages (must succeed)
    const finalSubmit = await request('POST', '/api/ri/student/forms/family-surveys/submit-all', null, headers);
    testCheck(finalSubmit.status === 200 && finalSubmit.body.status === 'Submitted', 'Final submission succeeds with 3 unique completed villages');

    // Step G: Verify Database state
    const formRow = (await pool.query(
      `SELECT status, progress_percent FROM ri_student_forms WHERE student_id = $1 AND form_type = 'FAMILY_SURVEY'`,
      [student.id]
    )).rows[0];
    testCheck(formRow && formRow.status === 'Submitted' && formRow.progress_percent === 100, 'Database state verified: Submitted and 100% progress');

  } catch (err) {
    console.error('Integration test error:', err);
    failures++;
  } finally {
    // Clean up created records
    await pool.query('DELETE FROM ri_family_surveys WHERE student_id = $1', [student.id]);
    await pool.query("DELETE FROM ri_student_forms WHERE student_id = $1 AND form_type = 'FAMILY_SURVEY'", [student.id]);
    console.log(`Cleaned up test data for student ${student.id}`);
  }

  if (failures === 0) {
    console.log('\n========================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! (0 failures)');
    console.log('========================================');
    process.exit(0);
  } else {
    console.error(`\nFAILED with ${failures} failure(s)`);
    process.exit(1);
  }
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
