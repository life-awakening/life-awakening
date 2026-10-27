require('dotenv').config();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const API_BASE = 'http://localhost:5001';

async function testPortals() {
  console.log('================================================================');
  console.log('TESTING UNDERTAKING POPUP & PROFILE STATUS FOR BOTH PORTALS');
  console.log('================================================================');

  // Student 1: Undertaking Submitted (409838)
  const tokenSubmitted = jwt.sign(
    { id: 409838, email: 'ahsanimamkhan06@gmail.com', role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Student 2: Undertaking NOT Submitted (409834)
  const tokenPending = jwt.sign(
    { id: 409834, email: '1342250184@mitwpu.edu.in', role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('\n--- TEST CASE A & B: STUDENT WITH SUBMITTED UNDERTAKING (ID 409838) ---');
  
  // 1. RI Profile API
  const riProfRes1 = await fetch(`${API_BASE}/api/ri/student/profile`, {
    headers: { Authorization: `Bearer ${tokenSubmitted}` }
  });
  const riProfData1 = await riProfRes1.json();
  console.log('RI Profile API status:', riProfRes1.status);
  console.log('RI student.undertaking_submitted:', riProfData1?.student?.undertaking_submitted);
  console.log('RI undertaking_status.submitted:', riProfData1?.undertaking_status?.submitted);
  
  // Calculate isUndertakingSubmitted as frontend does
  const frontendRiIsSubmitted1 = Boolean(
    riProfData1?.student?.undertaking_submitted ||
    riProfData1?.undertaking_status?.submitted
  );
  console.log('Frontend RI isUndertakingSubmitted evaluates to:', frontendRiIsSubmitted1);
  console.log('Frontend RI Modal Open Condition (!isUndertakingSubmitted):', !frontendRiIsSubmitted1);
  console.log('RESULT FOR RI PORTAL: Modal is', !frontendRiIsSubmitted1 ? 'SHOWN (FAIL)' : 'SUPPRESSED (PASS)');

  // 2. LTC Student Dashboard API
  const ltcDashRes1 = await fetch(`${API_BASE}/api/student/dashboard`, {
    headers: { Authorization: `Bearer ${tokenSubmitted}` }
  });
  const ltcDashData1 = await ltcDashRes1.json();
  console.log('\nLTC Dashboard API status:', ltcDashRes1.status);
  console.log('LTC myData.undertaking_submitted:', ltcDashData1?.data?.undertaking_submitted);
  
  // Calculate LTC popup condition as frontend does:
  // !myData.undertaking_submitted && showGatePopup
  const frontendLtcPopupCondition1 = !ltcDashData1?.data?.undertaking_submitted;
  console.log('Frontend LTC Popup Condition (!myData.undertaking_submitted):', frontendLtcPopupCondition1);
  console.log('RESULT FOR LTC PORTAL: Popup is', frontendLtcPopupCondition1 ? 'SHOWN (FAIL)' : 'SUPPRESSED (PASS)');

  if (!frontendRiIsSubmitted1 || frontendLtcPopupCondition1) {
    console.error('FAILED: Submitted student should NOT see popup in either portal!');
    process.exit(1);
  }

  console.log('\n--- TEST CASE F: STUDENT WITHOUT SUBMITTED UNDERTAKING (ID 409834) ---');

  // 1. RI Profile API
  const riProfRes2 = await fetch(`${API_BASE}/api/ri/student/profile`, {
    headers: { Authorization: `Bearer ${tokenPending}` }
  });
  const riProfData2 = await riProfRes2.json();
  console.log('RI Profile API status:', riProfRes2.status);
  console.log('RI student.undertaking_submitted:', riProfData2?.student?.undertaking_submitted);
  console.log('RI undertaking_status.submitted:', riProfData2?.undertaking_status?.submitted);

  const frontendRiIsSubmitted2 = Boolean(
    riProfData2?.student?.undertaking_submitted ||
    riProfData2?.undertaking_status?.submitted
  );
  console.log('Frontend RI isUndertakingSubmitted evaluates to:', frontendRiIsSubmitted2);
  console.log('Frontend RI Modal Open Condition (!isUndertakingSubmitted):', !frontendRiIsSubmitted2);
  console.log('RESULT FOR RI PORTAL: Modal is', !frontendRiIsSubmitted2 ? 'SHOWN AS REQUIRED (PASS)' : 'SUPPRESSED (FAIL)');

  // 2. LTC Student Dashboard API
  const ltcDashRes2 = await fetch(`${API_BASE}/api/student/dashboard`, {
    headers: { Authorization: `Bearer ${tokenPending}` }
  });
  const ltcDashData2 = await ltcDashRes2.json();
  console.log('\nLTC Dashboard API status:', ltcDashRes2.status);
  console.log('LTC myData.undertaking_submitted:', ltcDashData2?.data?.undertaking_submitted);

  const frontendLtcPopupCondition2 = !ltcDashData2?.data?.undertaking_submitted;
  console.log('Frontend LTC Popup Condition (!myData.undertaking_submitted):', frontendLtcPopupCondition2);
  console.log('RESULT FOR LTC PORTAL: Popup is', frontendLtcPopupCondition2 ? 'SHOWN AS REQUIRED (PASS)' : 'SUPPRESSED (FAIL)');

  if (frontendRiIsSubmitted2 || !frontendLtcPopupCondition2) {
    console.error('FAILED: Unsubmitted student MUST see popup in both portals!');
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('ALL VERIFICATIONS PASSED 100% SUCCESFULLY!');
  console.log('================================================================');
  process.exit(0);
}

testPortals().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
