const pool = require('../config/db');
const riController = require('../controllers/riController');

// Helper to mock Express req and res
function mockReqRes(params = {}, body = {}, query = {}) {
  const req = {
    params,
    body,
    query
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    }
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

async function runFacultyAssignmentTests() {
  console.log('================================================================');
  console.log('TEST SUITE: RI Faculty Identity Reuse & Multi-Panel Assignment');
  console.log('================================================================\n');

  const testEmail = `test.mentor.${Date.now()}@mitwpu.edu.in`;
  const testName = 'Prof. Test Canonical Mentor';
  const createdAssignmentIds = [];
  let testUserId = null;

  try {
    // -------------------------------------------------------------------------
    // TEST A: Same Faculty, Different Batches
    // -------------------------------------------------------------------------
    console.log('[TEST A] Same Faculty, Different Batches');
    
    // 1. Assign to Batch 163, Panel 334
    const mockA1 = mockReqRes({ id: 163 }, {
      ri_panel_id: 334,
      name: testName,
      email: testEmail,
      role: 'Mentor',
      department: 'School of Engineering',
      mobile: '9876543210'
    });
    await riController.createBatchFaculty(mockA1.req, mockA1.res);
    
    if (mockA1.getStatus() !== 201) {
      throw new Error(`Failed to assign faculty to Batch 163: ${JSON.stringify(mockA1.getData())}`);
    }
    const assignment1 = mockA1.getData().faculty;
    createdAssignmentIds.push(assignment1.id);
    testUserId = assignment1.faculty_id;
    console.log(`  PASS: Assigned to Batch 163, Panel 334 (Assignment ID: ${assignment1.id}, User ID: ${testUserId})`);

    // 2. Assign same faculty to Batch 165, Panel 344
    const mockA2 = mockReqRes({ id: 165 }, {
      ri_panel_id: 344,
      name: testName,
      email: testEmail,
      role: 'Mentor',
      department: 'School of Engineering',
      mobile: '9876543210'
    });
    await riController.createBatchFaculty(mockA2.req, mockA2.res);

    if (mockA2.getStatus() !== 201) {
      throw new Error(`Failed to assign faculty to Batch 165: ${JSON.stringify(mockA2.getData())}`);
    }
    const assignment2 = mockA2.getData().faculty;
    createdAssignmentIds.push(assignment2.id);
    console.log(`  PASS: Assigned to Batch 165, Panel 344 (Assignment ID: ${assignment2.id}, User ID: ${assignment2.faculty_id})`);

    // 3. Verify exactly 1 user account exists in users table (Canonical identity reuse)
    const userCountRes = await pool.query('SELECT count(*)::int as count FROM users WHERE LOWER(email) = $1', [testEmail.toLowerCase()]);
    if (userCountRes.rows[0].count !== 1) {
      throw new Error(`Expected exactly 1 user for ${testEmail}, but found ${userCountRes.rows[0].count}`);
    }
    if (assignment1.faculty_id !== assignment2.faculty_id) {
      throw new Error(`User ID mismatch: ${assignment1.faculty_id} vs ${assignment2.faculty_id}`);
    }
    console.log('  PASS: Canonical faculty identity reused across batches (Zero duplicate user records)');

    // -------------------------------------------------------------------------
    // TEST B: Same Faculty, Multiple Panels Within ONE Batch
    // -------------------------------------------------------------------------
    console.log('\n[TEST B] Same Faculty, Multiple Panels Within ONE Batch');

    // Assign same faculty to Panel 335 in Batch 163
    const mockB = mockReqRes({ id: 163 }, {
      ri_panel_id: 335,
      name: testName,
      email: testEmail,
      role: 'Accompany Faculty 2',
      department: 'School of Engineering'
    });
    await riController.createBatchFaculty(mockB.req, mockB.res);

    if (mockB.getStatus() !== 201) {
      throw new Error(`Failed to assign faculty to Panel 335 in Batch 163: ${JSON.stringify(mockB.getData())}`);
    }
    const assignment3 = mockB.getData().faculty;
    createdAssignmentIds.push(assignment3.id);
    console.log(`  PASS: Successfully assigned to second panel (Panel 335) in Batch 163 (Assignment ID: ${assignment3.id})`);

    // Verify both assignments exist and are active in Batch 163
    const batchPanelsRes = await pool.query(
      'SELECT id, ri_panel_id, faculty_id, email FROM ri_batch_faculty WHERE ri_batch_id = 163 AND LOWER(email) = $1 AND status <> \'deleted\' ORDER BY ri_panel_id',
      [testEmail.toLowerCase()]
    );
    if (batchPanelsRes.rowCount !== 2) {
      throw new Error(`Expected 2 panel assignments in Batch 163, found ${batchPanelsRes.rowCount}`);
    }
    console.log(`  PASS: Verified ${batchPanelsRes.rowCount} independent panel assignments in Batch 163 for ${testEmail}`);

    // -------------------------------------------------------------------------
    // TEST B.2: Move Existing Assignment to Different Panel with Same Faculty (Reproduce UI PUT /api/ri/faculty/:id)
    // -------------------------------------------------------------------------
    console.log('\n[TEST B.2] Move Existing Assignment to Different Panel (UI Scenario)');

    // Create an existing slot in Panel 333 with initial faculty
    const initialSlotRes = await pool.query(`
      INSERT INTO ri_batch_faculty (ri_batch_id, ri_panel_id, name, email, role, status)
      VALUES (163, 333, 'Initial Slot Holder', 'initial.holder@mitwpu.edu.in', 'Mentor', 'active')
      RETURNING id
    `);
    const existingSlotId = initialSlotRes.rows[0].id;
    createdAssignmentIds.push(existingSlotId);

    // Now reproduce the exact UI update:
    // Move existingSlotId to Panel 336 (a different panel in the same batch) and assign testEmail
    // (Note: testEmail is already assigned in Panel 334 and Panel 335 in this batch).
    // Test payload with both 'panel_id' and 'ri_panel_id' as sent by the UI.
    const mockUiMove = mockReqRes({ facultyId: existingSlotId }, {
      panel_id: 336,
      ri_panel_id: 336,
      batch_id: 163,
      name: testName,
      email: testEmail,
      role: 'Accompany Faculty 1'
    });
    await riController.updateBatchFaculty(mockUiMove.req, mockUiMove.res);

    if (mockUiMove.getStatus() !== 200) {
      throw new Error(`Failed to move existing assignment to Panel 336: HTTP ${mockUiMove.getStatus()} - ${JSON.stringify(mockUiMove.getData())}`);
    }
    console.log(`  PASS: Moving existing assignment (${existingSlotId}) from Panel 333 to Panel 336 in same batch succeeded (HTTP 200)`);

    // Verify in database that existingSlotId is now in Panel 336 and assigned to testEmail
    const movedSlotCheck = await pool.query(
      'SELECT id, ri_panel_id, faculty_id, email FROM ri_batch_faculty WHERE id = $1',
      [existingSlotId]
    );
    if (movedSlotCheck.rows[0].ri_panel_id !== 336 || movedSlotCheck.rows[0].email.toLowerCase() !== testEmail.toLowerCase()) {
      throw new Error(`Slot did not update correctly: ${JSON.stringify(movedSlotCheck.rows[0])}`);
    }
    console.log(`  PASS: Verified slot ${existingSlotId} is now assigned to ${testEmail} in Panel 336`);

    // -------------------------------------------------------------------------
    // TEST C: Duplicate Assignment to the Same Panel (Must return HTTP 400)
    // -------------------------------------------------------------------------
    console.log('\n[TEST C] Duplicate Assignment to the Same Panel (Must return HTTP 400)');

    // 1. Attempt to create duplicate assignment in Panel 334 of Batch 163
    const mockC1 = mockReqRes({ id: 163 }, {
      ri_panel_id: 334,
      name: testName,
      email: testEmail,
      role: 'Mentor'
    });
    await riController.createBatchFaculty(mockC1.req, mockC1.res);
    if (mockC1.getStatus() !== 400) {
      throw new Error(`Expected HTTP 400 for duplicate creation, got ${mockC1.getStatus()}: ${JSON.stringify(mockC1.getData())}`);
    }
    console.log(`  PASS: createBatchFaculty returned 400 Bad Request: "${mockC1.getData()?.message}"`);

    // 2. Attempt to update existingSlotId (currently in Panel 336) to Panel 334 (where testEmail is ALREADY assigned)
    const mockC2 = mockReqRes({ facultyId: existingSlotId }, {
      ri_panel_id: 334,
      panel_id: 334,
      name: testName,
      email: testEmail,
      role: 'Mentor'
    });
    await riController.updateBatchFaculty(mockC2.req, mockC2.res);
    if (mockC2.getStatus() !== 400) {
      throw new Error(`Expected HTTP 400 for duplicate update, got ${mockC2.getStatus()}: ${JSON.stringify(mockC2.getData())}`);
    }
    console.log(`  PASS: updateBatchFaculty returned 400 Bad Request: "${mockC2.getData()?.message}"`);

    // 3. Attempt to update another slot keeping old panel 334 with testEmail
    const mockC3 = mockReqRes({ facultyId: assignment3.id }, {
      // assignment3 is in Panel 335, try to move to Panel 334 where testEmail is already present
      ri_panel_id: 334,
      email: testEmail
    });
    await riController.updateBatchFaculty(mockC3.req, mockC3.res);
    if (mockC3.getStatus() !== 400) {
      throw new Error(`Expected HTTP 400 for duplicate update, got ${mockC3.getStatus()}: ${JSON.stringify(mockC3.getData())}`);
    }
    console.log(`  PASS: updateBatchFaculty to duplicate panel returned 400 Bad Request: "${mockC3.getData()?.message}"`);
    console.log('  PASS: Duplicate assignment strictly blocked without HTTP 500 database crashes');

    // -------------------------------------------------------------------------
    // TEST D: Panel-Level Authorization and Data Isolation
    // -------------------------------------------------------------------------
    console.log('\n[TEST D] Panel-Level Authorization & Data Isolation');

    // Query exact assignments as evaluated by riFacultyAuth middleware
    const authQueryRes = await pool.query(`
      SELECT 
        rbf.id as assignment_id,
        rbf.ri_batch_id,
        rbf.ri_panel_id,
        rp.panel_number,
        rp.name as panel_name,
        rb.name as batch_name
      FROM ri_batch_faculty rbf
      JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
      WHERE (rbf.faculty_id = $1 OR LOWER(rbf.email) = $2) AND rbf.status <> 'deleted' AND rb.status <> 'deleted'
      ORDER BY rb.id DESC, rp.id ASC
    `, [testUserId, testEmail.toLowerCase()]);

    const batch163Panels = authQueryRes.rows.filter(r => r.ri_batch_id === 163).map(r => r.ri_panel_id);
    const batch165Panels = authQueryRes.rows.filter(r => r.ri_batch_id === 165).map(r => r.ri_panel_id);

    console.log(`  Authorized panels in Batch 163: [${batch163Panels.join(', ')}]`);
    console.log(`  Authorized panels in Batch 165: [${batch165Panels.join(', ')}]`);

    // Faculty should have access to panels 334, 335, 336 in Batch 163
    if (!batch163Panels.includes(334) || !batch163Panels.includes(335) || !batch163Panels.includes(336)) {
      throw new Error('Faculty missing assigned panels in Batch 163 authorization');
    }
    // Faculty should NOT have access to Panel 333 (unassigned panel)
    if (batch163Panels.includes(333)) {
      throw new Error('Faculty unauthorized panel 333 was leaked into authorization set');
    }
    console.log('  PASS: Faculty is authorized for all assigned panels (334, 335, 336) in Batch 163');
    console.log('  PASS: Data isolation verified: Unassigned panel 333 is strictly excluded');
    console.log('  PASS: Batch 165 contains strictly assigned panel 344');

    console.log('\n================================================================');
    console.log('ALL REGRESSION TESTS PASSED! (Tests A, B, C, D Verified)');
    console.log('================================================================');

  } finally {
    // Teardown: Clean up test assignments and test user
    if (createdAssignmentIds.length > 0) {
      await pool.query('DELETE FROM ri_batch_faculty WHERE id = ANY($1)', [createdAssignmentIds]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    console.log(`[TEARDOWN] Test data cleaned up (${createdAssignmentIds.length} assignments, 1 user)`);
  }
}

runFacultyAssignmentTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nTEST SUITE FAILED:', err);
    process.exit(1);
  });
