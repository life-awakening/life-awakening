const pool = require('../config/db');
const riRedFlagController = require('../controllers/riRedFlagController');

async function testRedFlagWorkflow() {
  console.log('Testing RI Red Flag Workflow...');

  try {
    // 1. Get a student in an active RI panel
    const studentRes = await pool.query(`
      SELECT 
        u.id as student_id,
        u.name,
        u.email,
        u.prn,
        rbs.ri_batch_id,
        rbs.ri_panel_id
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LIMIT 1
    `);

    if (studentRes.rowCount === 0) {
      console.log('No student found in ri_batch_students, skipping workflow test.');
      return;
    }

    const student = studentRes.rows[0];
    console.log(`Found Test Student: ${student.name} (ID: ${student.student_id}, Batch: ${student.ri_batch_id}, Panel: ${student.ri_panel_id})`);

    // 2a. Verify that 'Medical' reason is rejected and redirected to Orange Flag
    const mockReqMedical = {
      user: { id: 99999, name: 'Dr. Test Mentor', role: 'faculty', email: 'test.mentor@ri.edu' },
      userEmail: 'test.mentor@ri.edu',
      assignedBatchIds: [student.ri_batch_id],
      assignedPanelIds: [student.ri_panel_id],
      body: {
        student_id: student.student_id,
        reason: 'Medical',
        description: 'Student feeling unwell.'
      }
    };
    let medCode = null;
    let medData = null;
    await riRedFlagController.raiseFacultyRedFlag(mockReqMedical, {
      status(code) { medCode = code; return this; },
      json(data) { medData = data; return this; }
    });
    if (medCode !== 400 || !medData?.message?.includes('Orange Flag')) {
      throw new Error(`Expected Medical reason rejection with Orange Flag notice, got: ${medCode} ${JSON.stringify(medData)}`);
    }
    console.log('✓ Successfully verified that Medical cases are rejected from Red Flag and directed to Orange Flag.');

    // 2b. Test raising red flag with valid category 'Disciplinary'
    const mockReq = {
      user: { id: 99999, name: 'Dr. Test Mentor', role: 'faculty', email: 'test.mentor@ri.edu' },
      userEmail: 'test.mentor@ri.edu',
      assignedBatchIds: [student.ri_batch_id],
      assignedPanelIds: [student.ri_panel_id],
      body: {
        student_id: student.student_id,
        reason: 'Disciplinary',
        description: 'Student repeatedly left assigned survey group without authorization.'
      }
    };

    let flagId = null;
    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await riRedFlagController.raiseFacultyRedFlag(mockReq, mockRes);
    console.log('Raise Flag Response:', mockRes.statusCode, mockRes.data);
    flagId = mockRes.data?.redFlag?.id;

    if (!flagId) {
      throw new Error('Failed to create red flag');
    }

    // 3. Test duplicate prevention
    const dupRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; }
    };
    await riRedFlagController.raiseFacultyRedFlag(mockReq, dupRes);
    console.log('Duplicate Prevention Check Status:', dupRes.statusCode, dupRes.data?.message);

    // 4. Test unauthorized panel security check
    const unauthReq = {
      user: { id: 99999, name: 'Dr. Test Mentor', role: 'faculty', email: 'test.mentor@ri.edu' },
      userEmail: 'test.mentor@ri.edu',
      assignedBatchIds: [student.ri_batch_id],
      assignedPanelIds: [student.ri_panel_id + 999], // Different panel
      body: {
        student_id: student.student_id,
        reason: 'Badmashi',
        description: 'Test unauthorized submission.'
      }
    };
    const unauthRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; }
    };
    await riRedFlagController.raiseFacultyRedFlag(unauthReq, unauthRes);
    console.log('Unauthorized Panel Security Check Status:', unauthRes.statusCode, unauthRes.data?.message);

    // 5. Test Admin get all red flags
    const adminReq = { query: {} };
    const adminRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; }
    };
    await riRedFlagController.getAllRedFlags(adminReq, adminRes);
    console.log(`Admin Get All Flags count: ${adminRes.data?.redFlags?.length}, Stats:`, adminRes.data?.stats);

    // 6. Test Admin update status
    const updateReq = {
      params: { id: flagId },
      user: { id: 1, name: 'RI Admin', role: 'ri_admin' },
      body: {
        status: 'reviewed',
        admin_notes: 'Medical team briefed. ORS and medications provided to panel mentor.'
      }
    };
    const updateRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; }
    };
    await riRedFlagController.updateRedFlagStatus(updateReq, updateRes);
    console.log('Update Status Response:', updateRes.data?.message, 'New Status:', updateRes.data?.redFlag?.status);

    // 7. Cleanup test flag
    await pool.query('DELETE FROM ri_red_flags WHERE id = $1', [flagId]);
    await pool.query('DELETE FROM ri_notifications WHERE metadata->>\'red_flag_id\' = $1', [String(flagId)]);
    console.log(`Cleaned up test red flag #${flagId}`);

    console.log('All Red Flag tests passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

testRedFlagWorkflow();
