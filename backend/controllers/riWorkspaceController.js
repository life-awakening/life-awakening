const pool = require('../config/db');

/**
 * Get all authorized RI workspaces (Faculty and Nodal Officer assignments)
 * for the currently authenticated user.
 */
const getMyWorkspaces = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = (req.user?.email || '').trim().toLowerCase();
    const userRole = (req.user?.role || '').trim().toLowerCase();

    if (!userId && !userEmail) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const isAdmin = ['superadmin', 'superadmin-ri', 'ri_admin'].includes(userRole);

    // 1. Fetch Faculty Assignments
    const facQuery = `
      SELECT 
        rbf.id as assignment_id,
        'faculty' as workspace_type,
        COALESCE(NULLIF(TRIM(rbf.role), ''), 'Faculty Mentor') as role_title,
        rbf.department,
        rbf.ri_batch_id as batch_id,
        rb.name as batch_name,
        rbf.ri_panel_id as panel_id,
        rp.panel_number,
        rp.name as panel_name,
        v.name as village_name
      FROM ri_batch_faculty rbf
      JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
      JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE (rbf.faculty_id = $1 OR LOWER(TRIM(COALESCE(rbf.email, ''))) = LOWER(TRIM($2)))
        AND rbf.status <> 'deleted'
        AND rb.status <> 'deleted'
      ORDER BY rb.id DESC, rp.panel_number ASC
    `;

    // 2. Fetch Nodal Officer Assignments
    const nodQuery = `
      SELECT 
        rp.id as panel_id,
        'nodal_officer' as workspace_type,
        'Nodal Officer' as role_title,
        rp.department,
        rp.ri_batch_id as batch_id,
        rb.name as batch_name,
        rp.panel_number,
        rp.name as panel_name,
        v.name as village_name
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE (rp.nodal_officer_user_id = $1 OR LOWER(TRIM(COALESCE(rp.nodal_officer_email, ''))) = LOWER(TRIM($2)))
        AND rb.status <> 'deleted'
      ORDER BY rb.id DESC, rp.panel_number ASC
    `;

    const [facRes, nodRes] = await Promise.all([
      pool.query(facQuery, [userId || -1, userEmail]),
      pool.query(nodQuery, [userId || -1, userEmail])
    ]);

    const facultyAssignments = facRes.rows.map(r => ({
      id: `faculty_${r.assignment_id}`,
      assignment_id: r.assignment_id,
      type: 'faculty',
      role: r.role_title,
      department: r.department,
      batch_id: r.batch_id,
      batch_name: r.batch_name,
      panel_id: r.panel_id,
      panel_number: r.panel_number,
      panel_name: r.panel_name,
      village_name: r.village_name
    }));

    const nodalAssignments = nodRes.rows.map(r => ({
      id: `nodal_${r.panel_id}`,
      type: 'nodal_officer',
      role: r.role_title,
      department: r.department,
      batch_id: r.batch_id,
      batch_name: r.batch_name,
      panel_id: r.panel_id,
      panel_number: r.panel_number,
      panel_name: r.panel_name,
      village_name: r.village_name
    }));

    const totalCount = facultyAssignments.length + nodalAssignments.length;

    return res.json({
      success: true,
      user: {
        id: userId,
        name: req.user?.name,
        email: userEmail,
        role: userRole
      },
      is_admin: isAdmin,
      faculty_assignments: facultyAssignments,
      nodal_assignments: nodalAssignments,
      total_count: totalCount
    });
  } catch (err) {
    console.error('Error fetching authorized RI workspaces:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch workspaces' });
  }
};

module.exports = {
  getMyWorkspaces
};
