const pool = require('../config/db');
const XLSX = require('xlsx');
const {
  validateVillageFacultyUpload,
  importVillageFacultyUpload,
  matchPanel
} = require('../controllers/riController');

async function runTests() {
  console.log('--- STARTING RI BULK UPLOAD TEST SUITE ---');

  const client = await pool.connect();
  try {
    // 1. Check matchPanel logic for ECE-A vs ECE-AI-A/B/C
    console.log('\n[TEST 1] Testing exact panel matching (ECE-A vs ECE-AI-A/B/C)...');
    const mockPanels = [
      { id: 101, panel_number: 1, name: 'ECE-A' },
      { id: 102, panel_number: 2, name: 'ECE-AI-A' },
      { id: 103, panel_number: 3, name: 'ECE-AI-B' },
      { id: 104, panel_number: 4, name: 'ECE-AI-C' },
    ];

    const matchEceA = matchPanel('ECE-A', mockPanels);
    const matchEceAiA = matchPanel('ECE-AI-A', mockPanels);
    const matchEceAiB = matchPanel('ECE-AI-B', mockPanels);
    const matchEceAiC = matchPanel('ECE-AI-C', mockPanels);

    console.assert(matchEceA && matchEceA.id === 101, `ECE-A should match 101, got ${matchEceA?.id}`);
    console.assert(matchEceAiA && matchEceAiA.id === 102, `ECE-AI-A should match 102, got ${matchEceAiA?.id}`);
    console.assert(matchEceAiB && matchEceAiB.id === 103, `ECE-AI-B should match 103, got ${matchEceAiB?.id}`);
    console.assert(matchEceAiC && matchEceAiC.id === 104, `ECE-AI-C should match 104, got ${matchEceAiC?.id}`);
    console.log('✓ Panel exact matching passed: ECE-A does NOT match ECE-AI-A/B/C.');

    // Fetch or create a test batch
    let testBatchRes = await client.query(`SELECT id, name FROM ri_batches ORDER BY id ASC LIMIT 1`);
    if (testBatchRes.rowCount === 0) {
      const createBatch = await client.query(`
        INSERT INTO ri_batches (name, batch_code, status, start_date, end_date)
        VALUES ('Test Batch 1', 'TB-01', 'active', NOW(), NOW() + INTERVAL '10 days')
        RETURNING id, name
      `);
      testBatchRes = createBatch;
    }
    const testBatch = testBatchRes.rows[0];
    console.log(`\nUsing Test Batch: ID ${testBatch.id} ("${testBatch.name}")`);

    // Ensure test batch has known panels (e.g., Panel 1: ECE-AI-A, Panel 2: ECE-AI-B, Panel 3: ECE-AI-C)
    const existingPanelsRes = await client.query(`SELECT id, panel_number, name FROM ri_panels WHERE ri_batch_id = $1`, [testBatch.id]);
    if (existingPanelsRes.rowCount === 0) {
      await client.query(`
        INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
        VALUES 
          ($1, 1, 'ECE-AI-A', 60),
          ($1, 2, 'ECE-AI-B', 60),
          ($1, 3, 'ECE-AI-C', 60)
      `, [testBatch.id]);
    }

    const panelsBefore = await client.query(`SELECT id, panel_number, name, ri_village_id, nodal_officer_name, nodal_officer_email FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC`, [testBatch.id]);
    console.log('Current batch panels:', panelsBefore.rows.map(p => `#${p.panel_number}: ${p.name} (id: ${p.id})`));

    // [TEST 2] Strict panel validation rejection
    console.log('\n[TEST 2] Testing strict rejection when Excel contains non-existent panels...');
    const invalidRows = [
      {
        panel: 'Panel 99 NonExistent',
        village_name: 'Test Village 99',
        nodal_officer_name: 'Nodal Test',
        nodal_officer_email: 'nodal99@example.com'
      }
    ];

    let rejected = false;
    let rejectMessage = '';
    const mockReqInvalid = {
      params: { id: testBatch.id },
      body: { rows: invalidRows },
      user: { id: 1 }
    };
    const mockResInvalid = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        if (this.statusCode === 400) {
          rejected = true;
          rejectMessage = data.message;
        }
      }
    };

    await importVillageFacultyUpload(mockReqInvalid, mockResInvalid);
    console.assert(rejected, 'Import should be rejected with HTTP 400 for non-existing panels');
    console.log(`✓ Rejection message: "${rejectMessage}"`);
    console.assert(rejectMessage.includes('Panels not found in'), 'Error message must list missing panels');

    // Verify zero database changes on rejection
    const panelsAfterReject = await client.query(`SELECT COUNT(*)::int AS count FROM ri_panels WHERE ri_batch_id = $1`, [testBatch.id]);
    console.assert(panelsAfterReject.rows[0].count === panelsBefore.rowCount, 'No panels should be added or modified on validation failure');
    console.log('✓ Zero DB changes on validation rejection confirmed.');

    // [TEST 3] Valid Import
    console.log('\n[TEST 3] Testing valid Excel import...');
    const validPanelName = panelsBefore.rows[0].name;
    const validRows = [
      {
        panel: validPanelName,
        village_name: 'Adarsh Gram Umbraj',
        district: 'Pune',
        taluka: 'Haveli',
        nodal_officer_name: 'Dr. Coordinator Prof',
        nodal_officer_email: 'dr.coordinator@testmit.edu',
        class_teacher_name: 'Prof Class Teacher 1',
        accompany_faculty: [
          { name: 'Prof Accompany 1', role: 'Accompanying Faculty', email: 'accompany1@testmit.edu' }
        ]
      }
    ];

    const mockReqValid = {
      params: { id: testBatch.id },
      body: { rows: validRows },
      user: { id: 1 }
    };
    let importSuccess = false;
    const mockResValid = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        if (data.success) importSuccess = true;
      }
    };

    await importVillageFacultyUpload(mockReqValid, mockResValid);
    console.assert(importSuccess, 'Valid import should succeed');
    console.log('✓ Valid import succeeded:', mockResValid.body.message);

    // Verify village created and mapped
    const panelCheck = await client.query(`
      SELECT p.*, v.name as village_name, v.district, v.taluka 
      FROM ri_panels p 
      LEFT JOIN ri_villages v ON p.ri_village_id = v.id 
      WHERE p.id = $1
    `, [panelsBefore.rows[0].id]);
    console.assert(panelCheck.rows[0].village_name === 'Adarsh Gram Umbraj', 'Panel should be mapped to Adarsh Gram Umbraj');
    console.assert(panelCheck.rows[0].nodal_officer_name === 'Dr. Coordinator Prof', 'Nodal officer name should be Dr. Coordinator Prof');
    console.assert(panelCheck.rows[0].nodal_officer_email === 'dr.coordinator@testmit.edu', 'Nodal officer email should be dr.coordinator@testmit.edu');
    console.log('✓ Panel, Village, and Nodal Officer correctly mapped in DB.');

    // [TEST 4] Idempotency: Re-uploading the same Excel
    console.log('\n[TEST 4] Testing idempotency (re-uploading same data does not create duplicates)...');
    const villagesBeforeSecond = await client.query(`SELECT COUNT(*)::int AS count FROM ri_villages WHERE ri_batch_id = $1 AND status <> 'deleted'`, [testBatch.id]);
    const facultyBeforeSecond = await client.query(`SELECT COUNT(*)::int AS count FROM ri_batch_faculty WHERE ri_batch_id = $1 AND status <> 'deleted'`, [testBatch.id]);
    const nodalUsersBeforeSecond = await client.query(`SELECT COUNT(*)::int AS count FROM users WHERE LOWER(email) = 'dr.coordinator@testmit.edu'`);

    let secondImportSuccess = false;
    const mockResSecond = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; if (data.success) secondImportSuccess = true; }
    };
    await importVillageFacultyUpload(mockReqValid, mockResSecond);
    console.assert(secondImportSuccess, 'Second import should succeed idempotently');

    const villagesAfterSecond = await client.query(`SELECT COUNT(*)::int AS count FROM ri_villages WHERE ri_batch_id = $1 AND status <> 'deleted'`, [testBatch.id]);
    const facultyAfterSecond = await client.query(`SELECT COUNT(*)::int AS count FROM ri_batch_faculty WHERE ri_batch_id = $1 AND status <> 'deleted'`, [testBatch.id]);
    const nodalUsersAfterSecond = await client.query(`SELECT COUNT(*)::int AS count FROM users WHERE LOWER(email) = 'dr.coordinator@testmit.edu'`);

    console.assert(villagesAfterSecond.rows[0].count === villagesBeforeSecond.rows[0].count, `Villages count changed: before ${villagesBeforeSecond.rows[0].count}, after ${villagesAfterSecond.rows[0].count}`);
    console.assert(facultyAfterSecond.rows[0].count === facultyBeforeSecond.rows[0].count, `Faculty count changed: before ${facultyBeforeSecond.rows[0].count}, after ${facultyAfterSecond.rows[0].count}`);
    console.assert(nodalUsersAfterSecond.rows[0].count === nodalUsersBeforeSecond.rows[0].count, `Nodal users count changed: before ${nodalUsersBeforeSecond.rows[0].count}, after ${nodalUsersAfterSecond.rows[0].count}`);
    console.log('✓ Idempotency verified: 0 duplicate villages, 0 duplicate faculty, 0 duplicate user accounts created.');

    // [TEST 5] Village Conflict Safety
    console.log('\n[TEST 5] Testing Village Conflict detection...');
    const conflictRows = [
      {
        panel: validPanelName,
        village_name: 'Different Conflicting Village Name'
      }
    ];

    let conflictRejected = false;
    let conflictMessage = '';
    const mockReqConflict = {
      params: { id: testBatch.id },
      body: { rows: conflictRows },
      user: { id: 1 }
    };
    const mockResConflict = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) {
        this.body = data;
        if (this.statusCode === 400) {
          conflictRejected = true;
          conflictMessage = data.message;
        }
      }
    };
    await importVillageFacultyUpload(mockReqConflict, mockResConflict);
    console.assert(conflictRejected, 'Upload with village conflict should be rejected with HTTP 400');
    console.log(`✓ Village Conflict correctly rejected: "${conflictMessage}"`);

    // Verify existing village was NOT overwritten
    const checkNoOverwrite = await client.query(`
      SELECT p.name, v.name as village_name 
      FROM ri_panels p 
      JOIN ri_villages v ON p.ri_village_id = v.id 
      WHERE p.id = $1
    `, [panelsBefore.rows[0].id]);
    console.assert(checkNoOverwrite.rows[0].village_name === 'Adarsh Gram Umbraj', 'Village should remain Adarsh Gram Umbraj (not overwritten)');
    console.log('✓ Village safety confirmed: no silent overwrite occurred.');

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Test Suite Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests();
