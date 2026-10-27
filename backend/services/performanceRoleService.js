const pool = require('../config/db');

const PERFORMANCE_ROLES = ['Fall In', 'Yoga', 'Agriculture'];

const ROLE_TO_ACTIVITIES_MAP = {
  'Fall In': ['Punctuality - Fall In'],
  'Yoga': ['Punctuality - Yoga'],
  'Agriculture': ['Punctuality - Agri 1', 'Punctuality - Agri 2', 'Agriculture']
};

/**
 * Returns all activity titles permitted for the given array of performance roles.
 */
function getActivitiesForRoles(roles = []) {
  const activities = new Set();
  (roles || []).forEach(role => {
    const mapped = ROLE_TO_ACTIVITIES_MAP[role];
    if (mapped) {
      mapped.forEach(act => activities.add(act));
    }
  });
  return Array.from(activities);
}

/**
 * Checks if a specific activity title is permitted by any of the user's assigned roles.
 */
function isActivityAllowedForUserRoles(activityTitle, roles = []) {
  if (!activityTitle) return false;
  const trimmed = String(activityTitle).trim();
  const allowed = getActivitiesForRoles(roles);
  return allowed.some(a => a.toLowerCase() === trimmed.toLowerCase());
}

/**
 * Fetches all assigned performance roles for a specific user.
 */
async function getUserPerformanceRoles(userId) {
  if (!userId) return [];
  const res = await pool.query(
    `SELECT role_name FROM performance_admin_roles WHERE user_id = $1 ORDER BY role_name ASC`,
    [userId]
  );
  return res.rows.map(r => r.role_name);
}

/**
 * Fetches all eligible candidates (Faculty & LTC Members) along with their assigned performance roles.
 * Strictly excludes superadmin and superadmin_readonly.
 */
async function getAllPerformanceAdmins(search = '') {
  let query = `
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.role, 
      u.base_role, 
      u.department, 
      u.school, 
      u.status, 
      u.is_locked,
      COALESCE(
        JSON_AGG(par.role_name) FILTER (WHERE par.role_name IS NOT NULL),
        '[]'::json
      ) as assigned_roles
    FROM users u
    LEFT JOIN performance_admin_roles par ON u.id = par.user_id
    WHERE u.role IN ('faculty', 'ltc_member')
      AND u.role NOT IN ('superadmin', 'superadmin_readonly', 'superadmin-ri', 'superadmin_ri_readonly', 'ri_admin', 'ri_faculty')
      AND (u.email NOT ILIKE '%@ri.edu%' AND u.email NOT ILIKE '%@ri.edu.in%' AND u.email NOT ILIKE 'test_readonly_%')
  `;
  const params = [];
  if (search && search.trim()) {
    query += ` AND (u.name ILIKE $1 OR u.email ILIKE $1 OR u.department ILIKE $1)`;
    params.push(`%${search.trim()}%`);
  }
  query += `
    GROUP BY u.id, u.name, u.email, u.role, u.base_role, u.department, u.school, u.status, u.is_locked
    ORDER BY u.name ASC
  `;
  const res = await pool.query(query, params);
  return res.rows;
}

/**
 * Sets the assigned performance roles for a user.
 */
async function setUserPerformanceRoles(userId, roles = [], assignedBy = null) {
  const cleanRoles = Array.from(new Set(roles.filter(r => PERFORMANCE_ROLES.includes(r))));
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Verify target user is eligible (faculty or ltc_member) and not superadmin or RI user
    const userCheck = await client.query('SELECT id, name, email, role FROM users WHERE id = $1', [userId]);
    if (userCheck.rowCount === 0) {
      throw new Error('User not found.');
    }
    const targetUser = userCheck.rows[0];
    if (
      ['superadmin', 'superadmin_readonly', 'superadmin-ri', 'superadmin_ri_readonly', 'ri_admin', 'ri_faculty'].includes(targetUser.role) ||
      (targetUser.email && (targetUser.email.toLowerCase().includes('@ri.edu') || targetUser.email.toLowerCase().startsWith('test_readonly_')))
    ) {
      throw new Error('Cannot assign Performance Admin roles to Super Admin or RI users.');
    }

    // Delete existing roles for this user
    await client.query('DELETE FROM performance_admin_roles WHERE user_id = $1', [userId]);

    // Insert new roles
    for (const roleName of cleanRoles) {
      await client.query(
        `INSERT INTO performance_admin_roles (user_id, role_name, assigned_by)
         VALUES ($1, $2, $3)`,
        [userId, roleName, assignedBy]
      );
    }

    await client.query('COMMIT');
    return { success: true, userId, assigned_roles: cleanRoles, user: targetUser };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Removes a specific performance role from a user.
 */
async function removeUserPerformanceRole(userId, roleName) {
  const res = await pool.query(
    `DELETE FROM performance_admin_roles WHERE user_id = $1 AND role_name = $2 RETURNING *`,
    [userId, roleName]
  );
  return res.rowCount > 0;
}

module.exports = {
  PERFORMANCE_ROLES,
  ROLE_TO_ACTIVITIES_MAP,
  getActivitiesForRoles,
  isActivityAllowedForUserRoles,
  getUserPerformanceRoles,
  getAllPerformanceAdmins,
  setUserPerformanceRoles,
  removeUserPerformanceRole
};
