const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * RI Faculty Authentication & Strict Panel-Level Authorization Middleware
 * Guarantees that RI Faculty can only access batches and panels explicitly assigned to them in ri_batch_faculty.
 */
const riFacultyAuth = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    let userEmail = decoded.email;
    if (!userEmail && decoded.id) {
      const uRes = await pool.query(`SELECT email, role FROM users WHERE id = $1`, [decoded.id]);
      if (uRes.rowCount > 0) {
        userEmail = uRes.rows[0].email;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ message: 'Invalid user session. Please log in again.' });
    }

    req.userEmail = userEmail.toLowerCase().trim();

    // Check panel assignments in ri_batch_faculty
    const assignRes = await pool.query(`
      SELECT 
        rbf.id as assignment_id,
        rbf.name as faculty_name,
        rbf.email as faculty_email,
        rbf.role as faculty_role,
        rbf.ri_batch_id,
        rbf.ri_panel_id,
        rp.panel_number,
        rp.name as panel_name,
        rb.name as batch_name,
        rb.status as batch_status
      FROM ri_batch_faculty rbf
      JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
      WHERE (rbf.faculty_id = $1 OR LOWER(rbf.email) = $2) AND rbf.status <> 'deleted' AND rb.status <> 'deleted'
      ORDER BY rb.id DESC, rp.panel_number ASC
    `, [decoded.id || -1, req.userEmail]);

    if (assignRes.rowCount === 0) {
      // Allow superadmin/ri_admin preview with warning if no direct assignment
      if (['superadmin', 'ri_admin', 'superadmin-ri', 'admin', 'superadmin_ri_readonly', 'superadmin-ri-readonly'].includes(decoded.role)) {
        req.isRiAdminPreview = true;
        // Fetch all active panels for preview
        const allPanels = await pool.query(`
          SELECT rp.id as ri_panel_id, rp.ri_batch_id 
          FROM ri_panels rp 
          JOIN ri_batches rb ON rp.ri_batch_id = rb.id 
          WHERE rb.status <> 'deleted'
        `);
        req.assignedPanelIds = allPanels.rows.map(p => p.ri_panel_id);
        req.assignedBatchIds = [...new Set(allPanels.rows.map(p => p.ri_batch_id))];
        req.facultyAssignments = [];
        return next();
      }

      return res.status(403).json({
        message: 'Access Denied: You do not have any active Rural Immersion panel assignments.'
      });
    }

    req.facultyAssignments = assignRes.rows;
    req.assignedPanelIds = assignRes.rows.map(a => a.ri_panel_id);
    req.assignedBatchIds = [...new Set(assignRes.rows.map(a => a.ri_batch_id))];

    // Compute distinct assigned batches with is_active flag
    const batchMap = new Map();
    assignRes.rows.forEach(a => {
      if (!batchMap.has(a.ri_batch_id)) {
        const s = (a.batch_status || '').toLowerCase();
        // A batch is considered active if it is active, immersion, upcoming, in_progress, ongoing, or not deleted/archived
        const isActive = s !== 'deleted' && s !== 'archived';
        batchMap.set(a.ri_batch_id, {
          id: a.ri_batch_id,
          name: a.batch_name,
          status: a.batch_status,
          is_active: isActive
        });
      }
    });

    const assignedBatches = Array.from(batchMap.values());
    req.assignedBatches = assignedBatches;
    const activeBatches = assignedBatches.filter(b => b.is_active);
    req.activeBatchIds = activeBatches.length > 0 
      ? activeBatches.map(b => b.id) 
      : assignedBatches.map(b => b.id);

    next();
  } catch (err) {
    console.error('RI Faculty Auth Middleware Error:', err);
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
};

module.exports = riFacultyAuth;
