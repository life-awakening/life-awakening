const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5181;
const API_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('====================================================');
  console.log('  TESTING LIFE AWAKENING STUDENT DIRECTORY & BATCHES ');
  console.log('====================================================');

  let adminToken = '';

  // Get admin token
  try {
    const adminUser = await pool.query("SELECT id, email, role FROM users WHERE role IN ('admin', 'superadmin') LIMIT 1");
    if (!adminUser.rows.length) {
      throw new Error('No admin user found in database');
    }
    const admin = adminUser.rows[0];
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    adminToken = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, user_role: admin.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    console.log(`✅ Generated admin token for ${admin.email} (${admin.role})`);
  } catch (err) {
    console.error('❌ Failed to prepare admin token:', err.message);
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  const createdUserIds = [];
  const createdBatchIds = [];

  try {
    // -------------------------------------------------------------------------
    // TEST SETUP: Create test students & parents
    // -------------------------------------------------------------------------
    console.log('\n--- Setup Test Data ---');

    // Parent A1 & A2 (for student 1 with TWO linked parents)
    const pA1 = await pool.query(
      "INSERT INTO users (name, email, role, phone, password) VALUES ('Parent One Alpha', 'test_p1_alpha@example.com', 'parent', '9876543210', 'hashedpass123') RETURNING id, email"
    );
    const pA2 = await pool.query(
      "INSERT INTO users (name, email, role, phone, password) VALUES ('Parent Two Alpha', 'test_p2_alpha@example.com', 'parent', '9876543211', 'hashedpass123') RETURNING id, email"
    );
    createdUserIds.push(pA1.rows[0].id, pA2.rows[0].id);

    // Parent B1 (for student 2 with ONE linked parent)
    const pB1 = await pool.query(
      "INSERT INTO users (name, email, role, phone, password) VALUES ('Parent One Beta', 'test_p1_beta@example.com', 'parent', '9876543220', 'hashedpass123') RETURNING id, email"
    );
    createdUserIds.push(pB1.rows[0].id);

    // Student 1: 6th grade, School X
    const s1 = await pool.query(
      "INSERT INTO users (name, email, role, class_grade, school, school_branch, roll_number, division, payment_status, parent_consent_confirmed, password) VALUES ('Student S1 Alpha', 'test_s1_alpha@school.internal', 'student', '6th', 'Springfield High', 'North Campus', 'R-01', 'A', 'paid', true, 'hashedpass123') RETURNING id"
    );
    createdUserIds.push(s1.rows[0].id);

    // Link Student 1 with Parent A1 (primary, Mother) and Parent A2 (secondary, Father)
    await pool.query(
      "INSERT INTO parent_students (parent_id, student_id, is_primary, relationship) VALUES ($1, $2, true, 'Mother'), ($3, $2, false, 'Father')",
      [pA1.rows[0].id, s1.rows[0].id, pA2.rows[0].id]
    );

    // Student 2: 7th grade, School Y
    const s2 = await pool.query(
      "INSERT INTO users (name, email, role, class_grade, school, school_branch, roll_number, division, payment_status, parent_consent_confirmed, password) VALUES ('Student S2 Beta', 'test_s2_beta@school.internal', 'student', '7th', 'Shelbyville Academy', 'East Branch', 'R-02', 'B', 'pending', false, 'hashedpass123') RETURNING id"
    );
    createdUserIds.push(s2.rows[0].id);

    // Link Student 2 with Parent B1 only
    await pool.query(
      "INSERT INTO parent_students (parent_id, student_id, is_primary, relationship) VALUES ($1, $2, true, 'Guardian')",
      [pB1.rows[0].id, s2.rows[0].id]
    );

    // Student 3: 8th grade, School Z
    const s3 = await pool.query(
      "INSERT INTO users (name, email, role, class_grade, school, school_branch, roll_number, division, payment_status, parent_consent_confirmed, password) VALUES ('Student S3 Gamma', 'test_s3_gamma@school.internal', 'student', '8th', 'Capital City School', 'Main', 'R-03', 'C', 'paid', true, 'hashedpass123') RETURNING id"
    );
    createdUserIds.push(s3.rows[0].id);

    // Student 4: 9th grade, School X
    const s4 = await pool.query(
      "INSERT INTO users (name, email, role, class_grade, school, school_branch, roll_number, division, payment_status, parent_consent_confirmed, password) VALUES ('Student S4 Delta', 'test_s4_delta@school.internal', 'student', '9th', 'Springfield High', 'South Campus', 'R-04', 'D', 'waived', true, 'hashedpass123') RETURNING id"
    );
    createdUserIds.push(s4.rows[0].id);

    // Student 5: 10th grade, School Y
    const s5 = await pool.query(
      "INSERT INTO users (name, email, role, class_grade, school, school_branch, roll_number, division, payment_status, parent_consent_confirmed, password) VALUES ('Student S5 Epsilon', 'test_s5_epsilon@school.internal', 'student', '10th', 'Shelbyville Academy', 'West Campus', 'R-05', 'A', 'paid', true, 'hashedpass123') RETURNING id"
    );
    createdUserIds.push(s5.rows[0].id);

    console.log('✅ Test students and parent records created.');

    // -------------------------------------------------------------------------
    // TEST 1: Student Directory returns permanent internal Student ID (LA-XXXXX)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Permanent Student ID (LA-XXXXX) Format ---');
    const dirRes = await fetch(`${API_URL}/api/admin/la/students?search=test_s1_alpha`, { headers });
    if (!dirRes.ok) throw new Error(`HTTP ${dirRes.status}: ${await dirRes.text()}`);
    const dirData = await dirRes.json();
    const student1 = dirData.students.find(s => s.id === s1.rows[0].id);
    if (!student1) throw new Error('Student 1 not found in directory');
    const expectedId1 = `LA-${String(s1.rows[0].id).padStart(5, '0')}`;
    if (student1.student_id !== expectedId1) {
      throw new Error(`Expected student_id ${expectedId1}, but got ${student1.student_id}`);
    }
    console.log(`✅ Verified Student ID format: ${student1.student_id} matches ${expectedId1}`);

    // -------------------------------------------------------------------------
    // TEST 2: Student with TWO linked parents returns both parent emails
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Two linked parents return both parent emails ---');
    console.log('student1 object returned from API:', JSON.stringify(student1, null, 2));
    if (student1.parent1_email !== 'test_p1_alpha@example.com' && student1.parent_1_email !== 'test_p1_alpha@example.com') {
      throw new Error(`Expected parent 1 email 'test_p1_alpha@example.com', got '${student1.parent1_email || student1.parent_1_email}'`);
    }
    if (student1.parent2_email !== 'test_p2_alpha@example.com' && student1.parent_2_email !== 'test_p2_alpha@example.com') {
      throw new Error(`Expected parent 2 email 'test_p2_alpha@example.com', got '${student1.parent2_email || student1.parent_2_email}'`);
    }
    console.log(`✅ Verified: Parent 1 Email = ${student1.parent_1_email}, Parent 2 Email = ${student1.parent_2_email}`);

    // -------------------------------------------------------------------------
    // TEST 3: Student with ONE linked parent returns Parent 1 email and null Parent 2 email
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: One linked parent returns Parent 1 email and null Parent 2 ---');
    const dirRes2 = await fetch(`${API_URL}/api/admin/la/students?search=test_s2_beta`, { headers });
    const dirData2 = await dirRes2.json();
    const student2 = dirData2.students.find(s => s.id === s2.rows[0].id);
    if (!student2) throw new Error('Student 2 not found in directory');
    if (student2.parent_1_email !== 'test_p1_beta@example.com') {
      throw new Error(`Expected parent_1_email 'test_p1_beta@example.com', got '${student2.parent_1_email}'`);
    }
    if (student2.parent_2_email !== null && student2.parent_2_email !== undefined) {
      throw new Error(`Expected parent_2_email null, got '${student2.parent_2_email}'`);
    }
    console.log(`✅ Verified: Parent 1 Email = ${student2.parent_1_email}, Parent 2 Email = null (frontend renders as '—')`);

    // -------------------------------------------------------------------------
    // TEST 4: Mixed-class batch accepts students across 6th, 7th, 8th, 9th, 10th
    // TEST 5: Mixed-school batch accepts students from different schools
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4 & 5: Mixed-Class and Mixed-School Batch Assignment ---');
    const bRes = await pool.query(
      "INSERT INTO batches (name, batch_code, start_date, end_date, status, capacity, is_deleted) VALUES ('Life Awakening Mixed Batch Test', 'LAM-01', NOW(), NOW() + INTERVAL '14 days', 'active', 50, false) RETURNING id"
    );
    const batchId = bRes.rows[0].id;
    createdBatchIds.push(batchId);

    const assignPayload = {
      student_ids: [s1.rows[0].id, s2.rows[0].id, s3.rows[0].id, s4.rows[0].id, s5.rows[0].id]
    };

    const assignRes = await fetch(`${API_URL}/api/admin/la/batches/${batchId}/assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify(assignPayload)
    });
    if (!assignRes.ok) throw new Error(`HTTP ${assignRes.status}: ${await assignRes.text()}`);
    const assignData = await assignRes.json();
    console.log(`✅ Assigned result: ${assignData.assignedCount} assigned, ${assignData.alreadyInBatchCount} already in batch`);
    if (assignData.assignedCount !== 5) {
      throw new Error(`Expected 5 assigned students, got ${assignData.assignedCount}`);
    }

    // Verify batch students listing returns all 5 with diverse classes and schools
    const batchStudentsRes = await fetch(`${API_URL}/api/admin/la/batches/${batchId}/students`, { headers });
    const batchStudentsData = await batchStudentsRes.json();
    const assignedGrades = batchStudentsData.students.map(s => s.class_grade).sort();
    console.log(`✅ Assigned classes in batch: ${JSON.stringify(assignedGrades)}`);
    const expectedGrades = ['10th', '6th', '7th', '8th', '9th'];
    if (JSON.stringify(assignedGrades) !== JSON.stringify(expectedGrades)) {
      throw new Error(`Expected grades ${JSON.stringify(expectedGrades)}, got ${JSON.stringify(assignedGrades)}`);
    }

    const assignedSchools = [...new Set(batchStudentsData.students.map(s => s.school))].sort();
    console.log(`✅ Assigned schools in batch: ${JSON.stringify(assignedSchools)}`);
    if (assignedSchools.length < 3) {
      throw new Error(`Expected at least 3 distinct schools in mixed batch, got ${assignedSchools.length}`);
    }
    console.log('✅ Successfully confirmed mixed-class (6th–10th) and mixed-school batch support!');

    // -------------------------------------------------------------------------
    // TEST 6: Duplicate batch assignments are prevented (alreadyInBatch)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Duplicate batch assignment prevention ---');
    const reassignRes = await fetch(`${API_URL}/api/admin/la/batches/${batchId}/assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify(assignPayload)
    });
    const reassignData = await reassignRes.json();
    console.log(`✅ Re-assign result: ${reassignData.assignedCount} assigned, ${reassignData.alreadyInBatchCount} already in batch`);
    if (reassignData.assignedCount !== 0 || reassignData.alreadyInBatchCount !== 5) {
      throw new Error(`Expected 0 assigned and 5 already in batch, got ${reassignData.assignedCount} and ${reassignData.alreadyInBatchCount}`);
    }
    console.log('✅ Duplicate batch assignment prevented correctly!');

    // -------------------------------------------------------------------------
    // TEST 7: Password hashes are never exposed in any student API
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Verify zero password hash exposure ---');
    for (const s of dirData.students) {
      if (s.password || s.password_hash || s.pass) {
        throw new Error(`CRITICAL: Password hash exposed in student directory record: ${JSON.stringify(s)}`);
      }
      if (s.parents) {
        for (const p of s.parents) {
          if (p.password || p.password_hash) {
            throw new Error(`CRITICAL: Password hash exposed in student's parent record: ${JSON.stringify(p)}`);
          }
        }
      }
    }
    for (const s of batchStudentsData.students) {
      if (s.password || s.password_hash || s.pass) {
        throw new Error(`CRITICAL: Password hash exposed in batch student record: ${JSON.stringify(s)}`);
      }
    }
    console.log('✅ Verified: No password hashes or sensitive credentials exposed in any API response!');

    console.log('\n====================================================');
    console.log('  ALL 7 TESTS PASSED WITH 100% SUCCESS!             ');
    console.log('====================================================');

  } finally {
    // Clean up test data
    console.log('\nCleaning up test artifacts...');
    if (createdBatchIds.length > 0) {
      await pool.query("DELETE FROM batch_students WHERE batch_id = ANY($1)", [createdBatchIds]);
      await pool.query("DELETE FROM batches WHERE id = ANY($1)", [createdBatchIds]);
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM parent_students WHERE student_id = ANY($1) OR parent_id = ANY($1)", [createdUserIds]);
      await pool.query("DELETE FROM users WHERE id = ANY($1)", [createdUserIds]);
    }
    console.log('✅ Clean up complete.');
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
