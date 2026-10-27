/**
 * batchResolver.js
 *
 * Business rule (simplified):
 *   - ACTIVE batch exists → return it with squad context.
 *   - NO active batch (completed / upcoming / archived / anything else) → return null.
 *     The dashboard will show "Not Assigned" / empty state.
 *
 * No database schema changes. No fallbacks to completed batches.
 */

const pool = require('../config/db');

/**
 * Resolves the active batch context for a given faculty / LTC member.
 *
 * Returns the member's active batch row, or null if no active batch exists.
 *
 * @param {object} dbPool    - pg Pool or PoolClient (pass pool or a transaction client)
 * @param {number} facultyId - users.id of the faculty or LTC member
 * @returns {object|null}    { batch_id, squad, batch_name, batch_status, start_date, end_date }
 *                           or null if no active batch is found.
 */
const resolveFacultyBatch = async (dbPool, facultyId) => {
  // Allow callers to pass just (facultyId) when the shared pool is fine
  if (typeof dbPool === 'number') {
    facultyId = dbPool;
    dbPool = pool;
  }

  const result = await dbPool.query(
    `SELECT
       bf.batch_id,
       bf.squad,
       b.name        AS batch_name,
       b.status      AS batch_status,
       b.start_date,
       b.end_date
     FROM batch_faculty bf
     JOIN batches b ON bf.batch_id = b.id
     WHERE bf.faculty_id = $1
       AND (b.is_deleted = false OR b.is_deleted IS NULL)
       AND b.status IN ('active', 'Immersion')
     ORDER BY bf.batch_id DESC
     LIMIT 1`,
    [facultyId]
  );

  // Only return data when there is an active batch.
  // Completed / upcoming / any other status → return null → UI shows empty state.
  return result.rowCount > 0 ? result.rows[0] : null;
};

module.exports = { resolveFacultyBatch };
