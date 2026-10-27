const pool = require('../config/db');

/**
 * RI Audit Logger
 * Records auditable actions across Student, Faculty, and Admin portals.
 */
async function logRiAction(dbClient, {
  userId,
  userEmail,
  userName,
  userRole,
  action,
  studentId = null,
  batchId = null,
  panelId = null,
  recordId = null,
  details = {},
  ipAddress = null
}) {
  try {
    const client = dbClient || pool;
    const query = `
      INSERT INTO ri_audit_logs (
        user_id, user_email, user_name, user_role, action,
        student_id, ri_batch_id, ri_panel_id, record_id, details, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, created_at
    `;
    const params = [
      userId || null,
      userEmail || null,
      userName || null,
      userRole || 'system',
      action,
      studentId || null,
      batchId || null,
      panelId || null,
      recordId ? String(recordId) : null,
      JSON.stringify(details || {}),
      ipAddress || null
    ];
    await client.query(query, params);

    // Prune ri_audit_logs strictly to latest 100 entries
    await client.query(`
      DELETE FROM ri_audit_logs 
      WHERE id NOT IN (
        SELECT id FROM ri_audit_logs 
        ORDER BY created_at DESC, id DESC 
        LIMIT 100
      )
    `).catch(e => console.error('RI Audit Log Prune Error:', e.message));
  } catch (err) {
    // Non-blocking error logging for audit trail
    console.error('RI Audit Log Error (non-blocking):', err.message);
  }
}

module.exports = {
  logRiAction
};
