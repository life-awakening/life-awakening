const assert = require('assert');
require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

async function runRiSuperAdminVerification() {
  console.log('\n========================================');
  console.log('  RI SUPER ADMIN END-TO-END VERIFICATION');
  console.log('========================================\n');

  try {
    // 1. Verify superadmin@ri.edu User Record & Authentication
    console.log('[1/8] Verifying default credentials and password hash...');
    const userRes = await pool.query("SELECT * FROM users WHERE email = 'superadmin@ri.edu'");
    assert(userRes.rowCount > 0, 'superadmin@ri.edu must exist in users table');
    const user = userRes.rows[0];
    assert.strictEqual(user.role, 'superadmin-ri', 'User role must be superadmin-ri');
    
    const isMatch = await bcrypt.compare('Pppp0000@', user.password);
    assert(isMatch, 'Password comparison for Pppp0000@ must succeed');
    console.log('✓ User superadmin@ri.edu authenticated with role: superadmin-ri');

    // 2. Verify Analytics Endpoint
    console.log('\n[2/8] Verifying Executive Analytics API...');
    const riSuperAdminController = require('../controllers/riSuperAdminController');
    let analyticsData = null;
    const reqAnalytics = { query: {} };
    const resAnalytics = {
      json: (data) => { analyticsData = data; },
      status: (code) => ({ json: (err) => { throw new Error(`Analytics failed: ${code} ${JSON.stringify(err)}`); } })
    };
    await riSuperAdminController.getRiSuperAdminAnalytics(reqAnalytics, resAnalytics);
    
    assert(analyticsData, 'Analytics data must not be null');
    assert(analyticsData.overview, 'Overview KPI object must exist');
    assert(analyticsData.student_analytics, 'Student analytics object must exist');
    assert(analyticsData.undertaking_analytics, 'Undertaking analytics object must exist');
    assert(analyticsData.attendance_overview, 'Attendance overview object must exist');
    assert(analyticsData.evaluation_overview, 'Evaluation overview object must exist');
    assert(Array.isArray(analyticsData.batch_breakdown), 'Batch breakdown array must exist');

    console.log('✓ Analytics overview cards:', analyticsData.overview);
    console.log('✓ Student Analytics:', analyticsData.student_analytics);
    console.log('✓ Undertaking Compliance:', analyticsData.undertaking_analytics);
    console.log('✓ Attendance Matrix:', analyticsData.attendance_overview);
    console.log('✓ Evaluation Metrics:', analyticsData.evaluation_overview);

    // 3. Verify Batches Overview
    console.log('\n[3/8] Verifying Batches Overview API...');
    let batchesData = null;
    const reqBatches = { query: {} };
    const resBatches = {
      json: (data) => { batchesData = data; },
      status: (code) => ({ json: (err) => { throw new Error(`Batches failed: ${code}`); } })
    };
    await riSuperAdminController.getRiSuperAdminBatches(reqBatches, resBatches);
    assert(batchesData && Array.isArray(batchesData.batches), 'Batches array must exist');
    console.log(`✓ Retrieved ${batchesData.batches.length} RI batches`);
    if (batchesData.batches.length > 0) {
      const b = batchesData.batches[0];
      assert(b.id, 'Batch ID must exist');
      assert(b.source_program, 'Batch source_program must exist');
      assert(b.total_students !== undefined, 'Total students count must exist');
      console.log(`✓ Sample Batch: ${b.name} (${b.source_program}), Students: ${b.total_students}, Panels: ${b.total_panels}`);
    }

    // 4. Verify Batch Details Drilldown
    console.log('\n[4/8] Verifying Batch Details Drilldown API...');
    if (batchesData.batches.length > 0) {
      const batchId = batchesData.batches[0].id;
      let detailData = null;
      const reqDetail = { params: { id: batchId } };
      const resDetail = {
        json: (data) => { detailData = data; },
        status: (code) => ({ json: (err) => { throw new Error(`Detail failed: ${code}`); } })
      };
      await riSuperAdminController.getRiSuperAdminBatchDetails(reqDetail, resDetail);
      assert(detailData, 'Batch detail data must exist');
      assert(detailData.batch, 'Batch info must exist');
      assert(Array.isArray(detailData.students), 'Students array must exist');
      assert(Array.isArray(detailData.panels), 'Panels array must exist');
      assert(Array.isArray(detailData.villages), 'Villages array must exist');
      assert(Array.isArray(detailData.faculty), 'Faculty array must exist');
      assert(Array.isArray(detailData.attendance), 'Attendance array must exist');
      assert(Array.isArray(detailData.evaluations), 'Evaluations array must exist');

      console.log(`✓ Batch Detail for "${detailData.batch.name}":`);
      console.log(`  - Students: ${detailData.students.length}`);
      console.log(`  - Panels: ${detailData.panels.length}`);
      console.log(`  - Villages: ${detailData.villages.length}`);
      console.log(`  - Faculty: ${detailData.faculty.length}`);
      console.log(`  - Evaluations: ${detailData.evaluations.length}`);
      console.log(`  - Undertakings Compliance Rate: ${detailData.stats.undertaking_percentage}%`);
    }

    // 5. Verify Panel & Faculty Mapping (Multiple Faculty per Panel)
    console.log('\n[5/8] Verifying Panel & Faculty Mapping API...');
    let mappingData = null;
    const reqMapping = { query: {} };
    const resMapping = {
      json: (data) => { mappingData = data; },
      status: (code) => ({ json: (err) => { throw new Error(`Mapping failed: ${code}`); } })
    };
    await riSuperAdminController.getPanelFacultyMapping(reqMapping, resMapping);
    assert(mappingData && Array.isArray(mappingData.mapping), 'Mapping array must exist');
    console.log(`✓ Retrieved ${mappingData.mapping.length} mapped panels`);
    mappingData.mapping.forEach(m => {
      console.log(`  - Panel #${m.panel_number} (${m.panel_name}) → Village: ${m.village_name || 'N/A'} → Students: ${m.student_count} → Faculty count: ${m.faculty.length}`);
    });

    // 6. Verify Faculty Management Directory
    console.log('\n[6/8] Verifying Faculty Management Directory API...');
    let facultyData = null;
    const reqFaculty = { query: {} };
    const resFaculty = {
      json: (data) => { facultyData = data; },
      status: (code) => ({ json: (err) => { throw new Error(`Faculty failed: ${code}`); } })
    };
    await riSuperAdminController.getFacultyManagement(reqFaculty, resFaculty);
    assert(facultyData && Array.isArray(facultyData.faculty), 'Faculty array must exist');
    console.log(`✓ Retrieved ${facultyData.faculty.length} faculty mentors`);
    if (facultyData.faculty.length > 0) {
      const f = facultyData.faculty[0];
      console.log(`  - Sample Faculty: ${f.name} (${f.email}), Dept: ${f.department}, Total Students: ${f.total_students_count}, Batches: ${f.total_batches_count}`);
    }

    // 7. Verify Global Search & Filtering
    console.log('\n[7/8] Verifying Global Search across RI Entities...');
    let searchData = null;
    const reqSearch = { query: { q: 'ri' } };
    const resSearch = {
      json: (data) => { searchData = data; },
      status: (code) => ({ json: (err) => { throw new Error(`Search failed: ${code}`); } })
    };
    await riSuperAdminController.searchRiSuperAdminEntities(reqSearch, resSearch);
    assert(searchData && searchData.results, 'Search results must exist');
    console.log('✓ Search results summary:');
    console.log(`  - Batches: ${searchData.results.batches?.length || 0}`);
    console.log(`  - Panels: ${searchData.results.panels?.length || 0}`);
    console.log(`  - Villages: ${searchData.results.villages?.length || 0}`);
    console.log(`  - Faculty: ${searchData.results.faculty?.length || 0}`);
    console.log(`  - Students: ${searchData.results.students?.length || 0}`);

    // 8. Verify Master Multi-Sheet Excel Export
    console.log('\n[8/8] Verifying Master Multi-Sheet Excel Workbook Export...');
    if (batchesData.batches.length > 0) {
      const batchId = batchesData.batches[0].id;
      let exportedBuffer = null;
      let headersSent = {};
      const reqExport = { params: { id: batchId } };
      const resExport = {
        setHeader: (name, val) => { headersSent[name] = val; },
        send: (buffer) => { exportedBuffer = buffer; },
        status: (code) => ({ json: (err) => { throw new Error(`Export failed: ${code}`); } })
      };
      await riSuperAdminController.exportBatchSummaryExcel(reqExport, resExport);
      assert(exportedBuffer, 'Exported workbook buffer must not be null');
      const workbook = XLSX.read(exportedBuffer, { type: 'buffer' });
      assert(workbook.SheetNames.length >= 6, 'Workbook must contain at least 6 sheets');
      console.log(`✓ Generated Excel Workbook with ${workbook.SheetNames.length} Sheets:`, workbook.SheetNames);
    }

    console.log('\n========================================');
    console.log('  ALL RI SUPER ADMIN VERIFICATIONS PASSED');
    console.log('========================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  }
}

runRiSuperAdminVerification();
