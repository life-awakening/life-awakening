const assert = require('assert');
require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const riSuperAdminController = require('../controllers/riSuperAdminController');
const authMiddleware = require('../middleware/auth');

const SECRET_KEY = process.env.JWT_SECRET || 'secret';

async function runReadOnlySuperAdminTests() {
  console.log('\n======================================================');
  console.log('  TESTING RI READ-ONLY SUPER ADMIN IAM & PERMISSIONS  ');
  console.log('======================================================\n');

  try {
    // 1. Authenticate as full RI Super Admin
    console.log('[1/6] Authenticating as full RI Super Admin...');
    const superUserRes = await pool.query("SELECT * FROM users WHERE email = 'superadmin@ri.edu'");
    assert(superUserRes.rowCount > 0, 'superadmin@ri.edu must exist in database');
    const superUser = superUserRes.rows[0];
    const superToken = jwt.sign({ id: superUser.id, email: superUser.email, role: superUser.role }, SECRET_KEY);
    console.log(`✓ Super Admin authenticated (Role: ${superUser.role})\n`);

    // 2. Create Read-Only Super Admin via controller
    const testAdmin = {
      name: 'Dr. Test ReadOnly SuperAdmin',
      email: `test_readonly_${Date.now()}@ri.edu`,
      employee_id: `EMP_RO_${Math.floor(Math.random() * 10000)}`
    };

    console.log(`[2/6] Creating Read-Only Super Admin: ${testAdmin.name} (${testAdmin.email}, ID: ${testAdmin.employee_id})...`);
    let createData = null;
    let createStatus = 200;
    const reqCreate = {
      user: superUser,
      body: testAdmin
    };
    const resCreate = {
      status: (code) => {
        createStatus = code;
        return {
          json: (d) => { createData = d; }
        };
      },
      json: (d) => { createData = d; }
    };

    await riSuperAdminController.createRiReadOnlySuperAdmin(reqCreate, resCreate);
    assert(createData && createData.success, 'Read-only super admin creation must succeed');
    console.log(`✓ Created successfully: ${createData.message}`);
    const createdUser = createData.user;
    assert.strictEqual(createdUser.role, 'superadmin_ri_readonly');
    assert.strictEqual(createdUser.employee_id, testAdmin.employee_id);

    // 3. List Read-Only Super Admins
    console.log('\n[3/6] Listing Read-Only Super Admins...');
    let listData = null;
    const reqList = { user: superUser, query: {} };
    const resList = {
      json: (d) => { listData = d; },
      status: (code) => ({ json: (err) => { throw new Error(`List failed: ${code}`); } })
    };
    await riSuperAdminController.getRiReadOnlySuperAdmins(reqList, resList);
    assert(listData && listData.readonly_admins, 'List must return readonly_admins array');
    const found = listData.readonly_admins.find(a => a.email === testAdmin.email);
    assert(found, `Created admin ${testAdmin.email} must be in listing`);
    console.log(`✓ Found created admin in directory: ${found.name} (Employee ID: ${found.employee_id}, Role: ${found.role})`);

    // 4. Test Login password verification
    console.log('\n[4/6] Verifying default credentials hash and JWT token issuance...');
    const userInDb = (await pool.query('SELECT * FROM users WHERE id = $1', [createdUser.id])).rows[0];
    const isPasswordMatch = await bcrypt.compare('Pppp0000@', userInDb.password);
    assert(isPasswordMatch, 'Default password Pppp0000@ must verify');
    const roToken = jwt.sign({ id: userInDb.id, email: userInDb.email, role: userInDb.role }, SECRET_KEY);
    console.log(`✓ Credentials and token verified for role: ${userInDb.role}`);

    // 5. Test Access to GET Routes via authMiddleware
    console.log('\n[5/6] Verifying GET access across RI Super Admin routes with read-only token...');
    const mockGetReq = {
      method: 'GET',
      headers: { authorization: `Bearer ${roToken}` }
    };
    let middlewarePassed = false;
    const mockNext = () => { middlewarePassed = true; };
    const middleware = authMiddleware(['superadmin-ri', 'superadmin']);
    
    middleware(mockGetReq, { status: () => ({ json: () => {} }) }, mockNext);
    assert(middlewarePassed, 'authMiddleware must allow GET requests for superadmin_ri_readonly');
    console.log('✓ authMiddleware permitted GET request for superadmin_ri_readonly');

    // 6. Test Backend RBAC: POST/PUT/DELETE mutations must be blocked
    console.log('\n[6/6] Verifying Backend RBAC: Mutations (POST/PUT/DELETE) must be blocked (403)...');
    const mockPostReq = {
      method: 'POST',
      headers: { authorization: `Bearer ${roToken}` }
    };
    let blockedStatus = null;
    let blockedMsg = null;
    const mockPostRes = {
      status: (code) => {
        blockedStatus = code;
        return {
          json: (err) => { blockedMsg = err.message; }
        };
      }
    };
    middleware(mockPostReq, mockPostRes, () => {
      throw new Error('authMiddleware incorrectly allowed POST request for read-only superadmin!');
    });
    assert.strictEqual(blockedStatus, 403, 'POST mutation must be blocked with 403');
    console.log(`✓ authMiddleware blocked POST mutation with 403: "${blockedMsg}"`);

    // 7. Cleanup: Revoke/Delete the test read-only superadmin
    console.log('\n[Cleanup] Revoking test read-only super admin access...');
    let deleteData = null;
    const reqDelete = { user: superUser, params: { id: createdUser.id } };
    const resDelete = {
      json: (d) => { deleteData = d; },
      status: (code) => ({ json: (err) => { throw new Error(`Delete failed: ${code}`); } })
    };
    await riSuperAdminController.deleteRiReadOnlySuperAdmin(reqDelete, resDelete);
    assert(deleteData && deleteData.success, 'Delete must succeed');
    console.log(`✓ ${deleteData.message}`);

    console.log('\n======================================================');
    console.log('  ALL READ-ONLY SUPER ADMIN TESTS PASSED PERFECTLY!   ');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runReadOnlySuperAdminTests();
