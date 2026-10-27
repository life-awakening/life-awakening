const test = require('node:test');
const assert = require('node:assert');
const pool = require('../config/db');
const performanceRoleService = require('../services/performanceRoleService');
const squadScoringEngine = require('../services/squadScoringEngine');

test('Performance Admin RBAC & Assignment Test Suite', async (t) => {
  let testBatchId = null;
  let facultyUser1 = null;
  let facultyUser2 = null;
  let facultyUser3 = null;

  await t.test('Setup: Create test users and batch', async () => {
    // 1. Create a test batch
    const batchRes = await pool.query(
      `INSERT INTO batches (name, status, is_deleted)
       VALUES ('Performance Admin Test Batch', 'active', false)
       RETURNING id`
    );
    testBatchId = batchRes.rows[0].id;

    // 2. Create 3 test faculty / ltc_member users
    const u1 = await pool.query(
      `INSERT INTO users (name, email, password, role, status, is_locked)
       VALUES ('Ravi FallIn Test', 'ravi.fallin@test.edu', 'pass', 'faculty', 'active', false)
       ON CONFLICT (email) DO UPDATE SET role = 'faculty'
       RETURNING id, name, email, role`
    );
    facultyUser1 = u1.rows[0];

    const u2 = await pool.query(
      `INSERT INTO users (name, email, password, role, status, is_locked)
       VALUES ('Amit Yoga Test', 'amit.yoga@test.edu', 'pass', 'faculty', 'active', false)
       ON CONFLICT (email) DO UPDATE SET role = 'faculty'
       RETURNING id, name, email, role`
    );
    facultyUser2 = u2.rows[0];

    const u3 = await pool.query(
      `INSERT INTO users (name, email, password, role, status, is_locked)
       VALUES ('Rahul Agri Test', 'rahul.agri@test.edu', 'pass', 'ltc_member', 'active', false)
       ON CONFLICT (email) DO UPDATE SET role = 'ltc_member'
       RETURNING id, name, email, role`
    );
    facultyUser3 = u3.rows[0];

    console.log(`✓ Setup complete: Batch ID ${testBatchId}, Users: ${facultyUser1.id}, ${facultyUser2.id}, ${facultyUser3.id}`);
  });

  await t.test('Test 1: List eligible candidates excludes Super Admin', async () => {
    const list = await performanceRoleService.getAllPerformanceAdmins();
    assert.ok(Array.isArray(list), 'Candidates list must be an array');
    
    // Check that superadmins are strictly not present
    const superAdminInList = list.find(u => u.role === 'superadmin' || u.role === 'superadmin_readonly');
    assert.strictEqual(superAdminInList, undefined, 'Super Admin and Readonly Super Admin must not be in list');

    // Check that faculty and ltc_members are present
    const f1 = list.find(u => u.id === facultyUser1.id);
    assert.ok(f1, 'Faculty user 1 must be present in eligible list');
    console.log('✓ Test 1 Passed: Super Admin strictly excluded and faculty listed.');
  });

  await t.test('Test 2: Super Admin assigns single and multiple roles', async () => {
    // Assign 'Fall In' to Ravi
    await performanceRoleService.setUserPerformanceRoles(facultyUser1.id, ['Fall In']);
    const r1 = await performanceRoleService.getUserPerformanceRoles(facultyUser1.id);
    assert.deepStrictEqual(r1, ['Fall In']);

    // Assign 'Yoga' to Amit
    await performanceRoleService.setUserPerformanceRoles(facultyUser2.id, ['Yoga']);
    const r2 = await performanceRoleService.getUserPerformanceRoles(facultyUser2.id);
    assert.deepStrictEqual(r2, ['Yoga']);

    // Assign 'Agriculture' to Rahul
    await performanceRoleService.setUserPerformanceRoles(facultyUser3.id, ['Agriculture']);
    const r3 = await performanceRoleService.getUserPerformanceRoles(facultyUser3.id);
    assert.deepStrictEqual(r3, ['Agriculture']);

    // Assign multiple roles to Ravi (Fall In + Yoga)
    await performanceRoleService.setUserPerformanceRoles(facultyUser1.id, ['Fall In', 'Yoga']);
    const r1Multi = await performanceRoleService.getUserPerformanceRoles(facultyUser1.id);
    assert.ok(r1Multi.includes('Fall In') && r1Multi.includes('Yoga'));
    console.log('✓ Test 2 Passed: Single and multiple role assignments verified.');
  });

  await t.test('Test 3: Role to Activity Permission Mapping', () => {
    // Fall In permissions
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Fall In', ['Fall In']), true);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Yoga', ['Fall In']), false);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Quiz', ['Fall In']), false);

    // Yoga permissions
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Yoga', ['Yoga']), true);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Fall In', ['Yoga']), false);

    // Agriculture permissions
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Agri 1', ['Agriculture']), true);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Agri 2', ['Agriculture']), true);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Agriculture', ['Agriculture']), true);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Debate', ['Agriculture']), false);

    // Multi-role permissions
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Fall In', ['Fall In', 'Yoga']), true);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Yoga', ['Fall In', 'Yoga']), true);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Discipline', ['Fall In', 'Yoga']), false);
    console.log('✓ Test 3 Passed: Activity RBAC mapping logic verified.');
  });

  await t.test('Test 4: Real-time marking and data integrity', async () => {
    // Reset Ravi to only 'Fall In'
    await performanceRoleService.setUserPerformanceRoles(facultyUser1.id, ['Fall In']);

    // Simulate saving 'Punctuality - Fall In' selection for Day 2
    await pool.query(
      `INSERT INTO squad_performance_selections (batch_id, day, activity_title, first_squad, second_squad, third_squad, squad_name, selected_by)
       VALUES ($1, 'Day 2', 'Punctuality - Fall In', 'Aditya', 'Bhaskar', 'Surya', 'Aditya', $2)
       ON CONFLICT (batch_id, day, activity_title) DO UPDATE
       SET first_squad = EXCLUDED.first_squad, second_squad = EXCLUDED.second_squad, third_squad = EXCLUDED.third_squad, squad_name = EXCLUDED.squad_name`,
      [testBatchId, facultyUser1.id]
    );

    // Verify record in database
    const selRes = await pool.query(
      `SELECT * FROM squad_performance_selections WHERE batch_id = $1 AND activity_title = 'Punctuality - Fall In'`,
      [testBatchId]
    );
    assert.strictEqual(selRes.rowCount, 1);
    assert.strictEqual(selRes.rows[0].first_squad, 'Aditya');
    assert.strictEqual(selRes.rows[0].second_squad, 'Bhaskar');
    assert.strictEqual(selRes.rows[0].third_squad, 'Surya');

    // Verify that leaderboard computation instantly calculates with this selection
    const perfResult = squadScoringEngine.calculateSquadPerformance(selRes.rows);
    const lb = perfResult.leaderboard;
    const aditya = lb.find(s => s.squad === 'Aditya');
    assert.ok(aditya, 'Aditya must be on leaderboard');
    assert.strictEqual(aditya.first_count, 1, 'Aditya has 1 gold from Fall In');
    console.log('✓ Test 4 Passed: Real-time selection immediately reflects in scoring and leaderboard.');
  });

  await t.test('Test 5: Role removal revokes permission', async () => {
    await performanceRoleService.removeUserPerformanceRole(facultyUser1.id, 'Fall In');
    const rAfter = await performanceRoleService.getUserPerformanceRoles(facultyUser1.id);
    assert.strictEqual(rAfter.length, 0);
    assert.strictEqual(performanceRoleService.isActivityAllowedForUserRoles('Punctuality - Fall In', rAfter), false);
    console.log('✓ Test 5 Passed: Role removal correctly revokes activity permission.');
  });

  await t.test('Cleanup: Remove test data', async () => {
    await pool.query(`DELETE FROM squad_performance_selections WHERE batch_id = $1`, [testBatchId]);
    await pool.query(`DELETE FROM performance_admin_roles WHERE user_id IN ($1, $2, $3)`, [facultyUser1.id, facultyUser2.id, facultyUser3.id]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [facultyUser1.id, facultyUser2.id, facultyUser3.id]);
    await pool.query(`DELETE FROM batches WHERE id = $1`, [testBatchId]);
    console.log('✓ Cleaned up test batch and users.');
    await pool.end();
  });
});

