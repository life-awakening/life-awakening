require('dotenv').config();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const API_BASE = 'http://localhost:5001';

async function runPackingIsolationTest() {
  console.log('================================================================');
  console.log('TESTING RI STUDENT PACKING READINESS: STUDENT-WISE ISOLATION');
  console.log('================================================================');

  const studentA_id = 409838; // MAHESH KULKARNI
  const studentB_id = 409834; // Ms Misthi Jain

  const tokenA = jwt.sign({ id: studentA_id, email: 'ahsanimamkhan06@gmail.com', role: 'student' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenB = jwt.sign({ id: studentB_id, email: '1342250184@mitwpu.edu.in', role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Initial State Check: Reset both student records in test DB to ensure a clean baseline
  await pool.query('DELETE FROM ri_student_packing_checklists WHERE student_id IN ($1, $2)', [studentA_id, studentB_id]);

  console.log('\n--- STEP 1: INITIAL STATE (Both Students start clean) ---');
  const initResA = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const initDataA = await initResA.json();
  console.log(`Student A initial packed_count: ${initDataA.packed_count}, percent: ${initDataA.progress_percent}%`);

  const initResB = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const initDataB = await initResB.json();
  console.log(`Student B initial packed_count: ${initDataB.packed_count}, percent: ${initDataB.progress_percent}%`);

  if (initDataA.packed_count !== 0 || initDataB.packed_count !== 0) {
    throw new Error('Initial state is not clean!');
  }

  console.log('\n--- STEP 2: STUDENT A MARKS 3 ITEMS PACKED ---');
  const studentAPacked = { c1: true, c2: true, w1: true };
  const saveResA = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      packed_items: studentAPacked,
      packed_count: 3,
      total_count: 25,
      progress_percent: 12
    })
  });
  const saveDataA = await saveResA.json();
  console.log(`Student A save response status: ${saveResA.status}, success: ${saveDataA.success}`);

  console.log('\n--- STEP 3: VERIFY STUDENT B IS UNTOUCHED & COMPLETELY ISOLATED ---');
  const checkResB = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const checkDataB = await checkResB.json();
  console.log(`Student B packed_count: ${checkDataB.packed_count}`);
  console.log('Student B packed_items:', checkDataB.packed_items);

  if (checkDataB.packed_count !== 0 || Object.keys(checkDataB.packed_items).length !== 0) {
    throw new Error('CRITICAL FAILURE: Student B saw Student A packing data!');
  }
  console.log('PASS: Student B is completely unaffected by Student A actions.');

  console.log('\n--- STEP 4: STUDENT B MARKS ALL 25 ITEMS PACKED (Mark All Packed) ---');
  const allPackedItems = {};
  for (let i = 1; i <= 25; i++) {
    allPackedItems[`item_${i}`] = true;
  }
  const saveResB = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      packed_items: allPackedItems,
      packed_count: 25,
      total_count: 25,
      progress_percent: 100
    })
  });
  const saveDataB = await saveResB.json();
  console.log(`Student B save response status: ${saveResB.status}, success: ${saveDataB.success}`);

  console.log('\n--- STEP 5: VERIFY STUDENT A STILL HAS ONLY 3 ITEMS PACKED ---');
  const checkResA = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const checkDataA = await checkResA.json();
  console.log(`Student A packed_count: ${checkDataA.packed_count}, percent: ${checkDataA.progress_percent}%`);
  console.log('Student A packed_items:', checkDataA.packed_items);

  if (checkDataA.packed_count !== 3 || checkDataA.packed_items.c1 !== true || checkDataA.packed_items.item_1 !== undefined) {
    throw new Error('CRITICAL FAILURE: Student A was modified by Student B Mark All Packed!');
  }
  console.log('PASS: Student A preserved its exact individual checklist (3 items).');

  console.log('\n--- STEP 6: STUDENT A RESETS CHECKLIST (handleReset) ---');
  const resetResA = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      packed_items: {},
      packed_count: 0,
      total_count: 25,
      progress_percent: 0
    })
  });
  const resetDataA = await resetResA.json();
  console.log(`Student A reset response status: ${resetResA.status}, success: ${resetDataA.success}`);

  // Check Student A is 0, Student B remains 25
  const verifyResA = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const finalDataA = await verifyResA.json();

  const verifyResB = await fetch(`${API_BASE}/api/ri/student/packing-checklist`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const finalDataB = await verifyResB.json();

  console.log(`Final Student A count: ${finalDataA.packed_count} (Expected 0)`);
  console.log(`Final Student B count: ${finalDataB.packed_count} (Expected 25)`);

  if (finalDataA.packed_count !== 0 || finalDataB.packed_count !== 25) {
    throw new Error('CRITICAL FAILURE: Reset affected another student or did not persist!');
  }

  console.log('\n--- STEP 7: DIRECT DATABASE ISOLATION VERIFICATION ---');
  const dbRows = await pool.query(
    'SELECT student_id, packed_count, progress_percent FROM ri_student_packing_checklists WHERE student_id IN ($1, $2) ORDER BY student_id',
    [studentA_id, studentB_id]
  );
  console.log('Database rows in ri_student_packing_checklists:', dbRows.rows);

  if (dbRows.rows.length !== 2) {
    throw new Error('Expected exactly 2 isolated database rows for the two students.');
  }

  console.log('\n================================================================');
  console.log('ALL STUDENT PACKING ISOLATION TESTS PASSED 100% SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

runPackingIsolationTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
