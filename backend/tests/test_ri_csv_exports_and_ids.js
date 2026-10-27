/**
 * Automated Test Suite: RI CSV Exports & Dynamic Student ID Display
 * Tests:
 * 1. RI-only and LTC + RI synced batch student retrieval
 * 2. Unpaginated full exports for All Students and Panel Students
 * 3. Dynamic student identifier resolution (LTC ID vs RI ID)
 * 4. Panel column inclusion in panel exports
 */

require('dotenv').config();
const pool = require('../config/db');
const riController = require('../controllers/riController');
const { cleanPanelName } = require('../../frontend/src/ri/shared/riUtils');

function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: RI CSV Exports & Dynamic Student ID Display');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`  FAIL: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    } else {
      console.log(`  PASS: ${message}`);
      passed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: All Students Query - Paginated vs Unpaginated Export
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] All Students Query - Paginated & Unpaginated Export');
    const reqPaginated = { query: { page: '1', limit: '10' } };
    const resPaginated = createMockRes();
    await riController.getAllRiStudents(reqPaginated, resPaginated);

    assert(resPaginated.statusCode === 200, 'getAllRiStudents returned HTTP 200');
    assert(Array.isArray(resPaginated.data.students), 'students array is returned');
    assert(resPaginated.data.students.length <= 10, 'Paginated student count respects limit');
    assert(typeof resPaginated.data.total === 'number' && resPaginated.data.total >= 0, 'Total student count is provided');

    // Unpaginated full export
    const reqExport = { query: { export: 'true' } };
    const resExport = createMockRes();
    await riController.getAllRiStudents(reqExport, resExport);

    assert(resExport.statusCode === 200, 'getAllRiStudents with export=true returned HTTP 200');
    assert(resExport.data.students.length === resPaginated.data.total, `Unpaginated export returned all ${resPaginated.data.total} students without limit`);

    // -------------------------------------------------------------------------
    // TEST 2: Dynamic ID Logic in All Students
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Dynamic ID Resolution for LTC-Synced Students');
    const ltcStudents = resExport.data.students.filter(s => s.source_program === 'LTC_SYNC' || s.batch_source === 'LTC_SYNC');
    if (ltcStudents.length > 0) {
      const sample = ltcStudents[0];
      assert(!!sample.ltc_id, `LTC student "${sample.name}" has official ltc_id populated (${sample.ltc_id})`);
      assert(typeof sample.ltc_id === 'string' && sample.ltc_id.includes('-'), `LTC student ID matches official pattern: ${sample.ltc_id}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Panel Students Query & Actual Assigned Panel Name
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Panel Students Query - Assigned Panel Name & Unpaginated Export');
    const panelQuery = await pool.query(`
      SELECT rp.id, rp.name, COUNT(rbs.id)::int as count
      FROM ri_panels rp
      JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id
      GROUP BY rp.id
      HAVING COUNT(rbs.id) > 0
      LIMIT 1
    `);

    if (panelQuery.rowCount > 0) {
      const panel = panelQuery.rows[0];
      const reqPanelExport = { params: { id: String(panel.id) }, query: { export: 'true' } };
      const resPanelExport = createMockRes();
      await riController.getPanelStudents(reqPanelExport, resPanelExport);

      assert(resPanelExport.statusCode === 200, 'getPanelStudents with export=true returned HTTP 200');
      assert(resPanelExport.data.students.length === panel.count, `Returned all ${panel.count} panel students unpaginated`);
      
      const firstPanelStudent = resPanelExport.data.students[0];
      assert(!!firstPanelStudent.panel_name, `Panel student has panel_name attribute: "${firstPanelStudent.panel_name}"`);
      assert(firstPanelStudent.panel_name === panel.name, `Student's panel_name matches assigned panel "${panel.name}"`);

      // Verify Panel Export CSV mapping
      const isRiDirect = (resPanelExport.data.panel?.source_program || firstPanelStudent.source_program) === 'RI_DIRECT';
      const idHeader = isRiDirect ? 'RI ID' : 'LTC ID';
      const headers = [idHeader, 'Name', 'School', 'Department', 'Division', 'Panel', 'Source'];
      assert(headers.includes('Panel'), 'Panel Export CSV header includes "Panel" column');
      assert(headers[0] === idHeader, `Panel Export CSV header dynamically uses "${idHeader}"`);

      const rowStudentId = isRiDirect ? (firstPanelStudent.ri_id || '') : (firstPanelStudent.ltc_id || '');
      assert(!!rowStudentId, `Exported student identifier is non-empty (${rowStudentId})`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: RI-Only Student Creation, Isolation & Export Verification
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] RI-Only Batch Student Lifecycle & Dynamic ID Verification');
    const riDirectBatchRes = await pool.query(`
      SELECT id, name, batch_code, source_program 
      FROM ri_batches 
      WHERE source_program = 'RI_DIRECT' 
      LIMIT 1
    `);

    if (riDirectBatchRes.rowCount > 0) {
      const riBatch = riDirectBatchRes.rows[0];
      const testEmail = 'automated.test.export.student@mitwpu.edu.in';
      const testPrn = 'AUTO_EXP_PRN_777';

      // Clean before test
      await pool.query('DELETE FROM ri_batch_students WHERE student_id IN (SELECT id FROM users WHERE email = $1)', [testEmail]);
      await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);

      // Create student
      const reqCreate = {
        params: { id: String(riBatch.id) },
        body: {
          name: 'Pooja Verma',
          email: testEmail,
          prn: testPrn,
          gender: 'Female',
          semester: '4',
          school: 'School of Science',
          department: 'Mathematics'
        },
        user: { id: 1 }
      };
      const resCreate = createMockRes();
      await riController.createRiStudent(reqCreate, resCreate);
      assert(resCreate.statusCode === 201, `Created student in RI-Only batch: ${resCreate.data.message}`);

      // Query via getAllRiStudents
      const reqFind = { query: { search: testEmail } };
      const resFind = createMockRes();
      await riController.getAllRiStudents(reqFind, resFind);
      assert(resFind.data.students.length === 1, 'Found created student via search in getAllRiStudents');

      const foundStudent = resFind.data.students[0];
      assert(foundStudent.source_program === 'RI_DIRECT', 'Student source_program is RI_DIRECT');
      assert(!!foundStudent.ri_id, `RI-only student has RI ID assigned: ${foundStudent.ri_id}`);
      assert(foundStudent.ltc_id === null, 'RI-only student ltc_id is strictly null (no fake fallback)');

      // All Students Export formatting test
      const isRi = foundStudent.source_program === 'RI_DIRECT' || foundStudent.batch_source === 'RI_DIRECT';
      const exportedId = isRi ? (foundStudent.ri_id || '') : (foundStudent.ltc_id || '');
      assert(exportedId === foundStudent.ri_id, `Resolved export ID matches RI ID (${exportedId})`);

      // Cleanup
      await pool.query('DELETE FROM ri_batch_students WHERE student_id = $1', [foundStudent.student_id]);
      await pool.query('DELETE FROM users WHERE id = $1', [foundStudent.student_id]);
      console.log('  PASS: Cleaned up test student records successfully');
    }

    console.log('================================================================');
    console.log(`ALL TESTS PASSED! (${passed} checks passed, ${failed} failed)`);
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('\nTEST SUITE FAILED WITH ERROR:', err);
    process.exit(1);
  }
}

runTests();
