const pool = require('../config/db');
const {
  sendRiNewTicketNotifications,
  sendRiTicketResolvedNotification
} = require('../utils/riTicketEmailTemplates');

/**
 * Helper to get student or faculty context (Batch, Panel, PRN, Name, Phone)
 */
const getUserRiContext = async (userId, userEmail, userRole) => {
  let context = {
    batchId: null,
    panelId: null,
    batchName: null,
    panelName: null,
    prn: null,
    phone: null,
    name: null,
    email: userEmail
  };

  try {
    // 1. Fetch user base record
    if (userId) {
      const uRes = await pool.query('SELECT id, name, email, role, prn, phone FROM users WHERE id = $1', [userId]);
      if (uRes.rowCount > 0) {
        const u = uRes.rows[0];
        context.name = u.name;
        context.email = u.email || userEmail;
        context.prn = u.prn;
        context.phone = u.phone;
      }
    }

    const cleanEmail = (context.email || userEmail || '').toLowerCase().trim();

    if (userRole === 'student' || userRole === 'ri_student') {
      // Find batch student record with users join
      const sRes = await pool.query(`
        SELECT 
          rbs.id as batch_student_id,
          rbs.student_id,
          u.name as student_name,
          u.email as student_email,
          u.prn,
          u.phone,
          rbs.ri_batch_id,
          rbs.ri_panel_id,
          rb.name as batch_name,
          rp.name as panel_name
        FROM ri_batch_students rbs
        JOIN users u ON rbs.student_id = u.id
        LEFT JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
        LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
        WHERE (rbs.student_id = $1 OR LOWER(u.email) = $2 OR u.prn = $3)
        ORDER BY rbs.id DESC LIMIT 1
      `, [userId || -1, cleanEmail, context.prn || '']);

      if (sRes.rowCount > 0) {
        const s = sRes.rows[0];
        context.batchId = s.ri_batch_id || context.batchId;
        context.panelId = s.ri_panel_id || context.panelId;
        context.batchName = s.batch_name || context.batchName;
        context.panelName = s.panel_name || context.panelName;
        context.prn = s.prn || context.prn;
        context.name = s.student_name || context.name;
        context.phone = s.phone || context.phone;
      }
    } else if (userRole === 'faculty' || userRole === 'ri_faculty') {
      // Find batch faculty assignment
      const fRes = await pool.query(`
        SELECT 
          rbf.id as assignment_id,
          rbf.name as faculty_name,
          rbf.email as faculty_email,
          rbf.ri_batch_id,
          rbf.ri_panel_id,
          rb.name as batch_name,
          rp.name as panel_name
        FROM ri_batch_faculty rbf
        LEFT JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
        LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
        WHERE (rbf.faculty_id = $1 OR LOWER(rbf.email) = $2)
          AND rbf.status <> 'deleted'
        ORDER BY rbf.id DESC LIMIT 1
      `, [userId || -1, cleanEmail]);

      if (fRes.rowCount > 0) {
        const f = fRes.rows[0];
        context.batchId = f.ri_batch_id || context.batchId;
        context.panelId = f.ri_panel_id || context.panelId;
        context.batchName = f.batch_name || context.batchName;
        context.panelName = f.panel_name || context.panelName;
        context.name = f.faculty_name || context.name;
      }
    }
  } catch (err) {
    console.error('[RI Support] Error fetching user context:', err.message);
  }

  return context;
};

/**
 * Create / Raise a new RI Support Ticket
 * POST /api/ri/support/tickets
 */
const raiseTicket = async (req, res) => {
  try {
    let userId = req.user?.id || null;
    const userRole = (req.user?.role || 'student').toLowerCase();
    const userEmail = req.userEmail || req.user?.email || '';
    const { subject, description, category = 'Problem', priority = 'Medium', screenshot = null } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter a ticket subject.' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a detailed description of your issue.' });
    }

    // Verify userId exists in users table to prevent FK violations
    if (userId) {
      const uCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (uCheck.rowCount === 0) {
        userId = null;
      }
    }

    // Resolve user context (batch, panel, prn, name)
    const ctx = await getUserRiContext(userId, userEmail, userRole);
    const finalName = ctx.name || req.user?.name || (userRole === 'student' ? 'RI Student' : 'RI Faculty Mentor');
    const finalEmail = ctx.email || userEmail;
    const cleanCategory = String(category || 'Problem').trim();
    const cleanPriority = String(priority || 'Medium').trim();
    const cleanSubject = String(subject).trim();
    const cleanDescription = String(description).trim();

    // Insert into ri_tickets
    const insertRes = await pool.query(`
      INSERT INTO ri_tickets (
        user_id,
        user_role,
        user_name,
        user_email,
        user_prn,
        user_phone,
        ri_batch_id,
        ri_panel_id,
        batch_name,
        panel_name,
        category,
        priority,
        subject,
        description,
        screenshot,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending')
      RETURNING id, created_at
    `, [
      userId,
      userRole === 'student' || userRole === 'ri_student' ? 'student' : 'faculty',
      finalName,
      finalEmail,
      ctx.prn || null,
      ctx.phone || null,
      ctx.batchId || null,
      ctx.panelId || null,
      ctx.batchName || null,
      ctx.panelName || null,
      cleanCategory,
      cleanPriority,
      cleanSubject,
      cleanDescription,
      screenshot || null
    ]);

    const createdTicket = insertRes.rows[0];
    const ticketId = createdTicket ? createdTicket.id : null;

    // Insert notification for RI Admin
    if (ticketId) {
      try {
        await pool.query(`
          INSERT INTO ri_notifications (
            title,
            message,
            type,
            target_role,
            user_id,
            is_read,
            metadata
          ) VALUES ($1, $2, 'ticket', 'admin', $3, FALSE, $4)
        `, [
          `New RI Ticket #RI-${ticketId}`,
          `${finalName} (${userRole.toUpperCase()}) raised: "${cleanSubject}"`,
          userId,
          JSON.stringify({
            ticketId,
            userRole,
            userName: finalName,
            userEmail: finalEmail,
            subject: cleanSubject,
            category: cleanCategory,
            priority: cleanPriority
          })
        ]);
      } catch (notifErr) {
        console.error('[RI Support] Error creating in-app notification:', notifErr.message);
      }

      // Non-blocking email dispatch to administrators
      sendRiNewTicketNotifications({
        ticketId,
        userName: finalName,
        userRole: userRole === 'student' || userRole === 'ri_student' ? 'Student' : 'Faculty',
        userEmail: finalEmail,
        userPrn: ctx.prn,
        category: cleanCategory,
        priority: cleanPriority,
        subject: cleanSubject,
        description: cleanDescription,
        batchName: ctx.batchName,
        panelName: ctx.panelName,
        createdAt: createdTicket.created_at || new Date()
      }).catch(err => {
        console.error('[RI Support Email Error]', err.message);
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Support ticket raised successfully.',
      ticketId,
      created_at: createdTicket?.created_at
    });
  } catch (err) {
    console.error('[RI Support] Error in raiseTicket:', err);
    return res.status(500).json({ success: false, message: 'Server error raising support ticket.' });
  }
};

/**
 * Get tickets raised by the current authenticated student/faculty
 * GET /api/ri/support/my-tickets
 */
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const userEmail = (req.userEmail || req.user?.email || '').toLowerCase().trim();

    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        user_role,
        user_name,
        user_email,
        user_prn,
        category,
        priority,
        subject,
        description,
        screenshot,
        status,
        admin_reply,
        resolution,
        resolved_by_name,
        resolved_at,
        created_at,
        updated_at,
        batch_name,
        panel_name
      FROM ri_tickets
      WHERE (user_id = $1 OR ($2 <> '' AND LOWER(user_email) = $2))
      ORDER BY id DESC
    `, [userId || -1, userEmail]);

    return res.json({
      success: true,
      tickets: result.rows
    });
  } catch (err) {
    console.error('[RI Support] Error in getMyTickets:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving your tickets.' });
  }
};

/**
 * Admin: Get all RI tickets with rich filtering & stats
 * GET /api/ri/support/admin/tickets
 */
const getAllRiTickets = async (req, res) => {
  try {
    const { status, role, category, search } = req.query;

    let query = `
      SELECT 
        t.id,
        t.user_id,
        t.user_role,
        t.user_name,
        t.user_email,
        t.user_prn,
        t.user_phone,
        t.ri_batch_id,
        t.ri_panel_id,
        t.batch_name,
        t.panel_name,
        t.category,
        t.priority,
        t.subject,
        t.description,
        t.screenshot,
        t.status,
        t.admin_reply,
        t.resolution,
        t.resolved_by,
        t.resolved_by_name,
        t.resolved_at,
        t.created_at,
        t.updated_at
      FROM ri_tickets t
      WHERE 1=1
    `;

    const params = [];

    if (status && status !== 'all') {
      params.push(status.toLowerCase());
      query += ` AND LOWER(t.status) = $${params.length}`;
    }

    if (role && role !== 'all') {
      params.push(role.toLowerCase());
      query += ` AND LOWER(t.user_role) = $${params.length}`;
    }

    if (category && category !== 'all') {
      params.push(category.toLowerCase());
      query += ` AND LOWER(t.category) = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const sIdx = params.length;
      query += ` AND (
        CAST(t.id AS TEXT) LIKE $${sIdx}
        OR LOWER(t.subject) LIKE $${sIdx}
        OR LOWER(t.description) LIKE $${sIdx}
        OR LOWER(COALESCE(t.user_name, '')) LIKE $${sIdx}
        OR LOWER(COALESCE(t.user_email, '')) LIKE $${sIdx}
        OR LOWER(COALESCE(t.user_prn, '')) LIKE $${sIdx}
        OR LOWER(COALESCE(t.batch_name, '')) LIKE $${sIdx}
        OR LOWER(COALESCE(t.panel_name, '')) LIKE $${sIdx}
      )`;
    }

    query += ` ORDER BY t.created_at DESC`;

    const result = await pool.query(query, params);

    // Compute metrics
    const allStatsRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int as in_progress,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved,
        COUNT(CASE WHEN user_role = 'student' THEN 1 END)::int as student_tickets,
        COUNT(CASE WHEN user_role = 'faculty' THEN 1 END)::int as faculty_tickets
      FROM ri_tickets
    `);

    const stats = allStatsRes.rows[0] || {
      total: 0,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      student_tickets: 0,
      faculty_tickets: 0
    };

    return res.json({
      success: true,
      tickets: result.rows,
      stats
    });
  } catch (err) {
    console.error('[RI Support] Error in getAllRiTickets:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving tickets.' });
  }
};

/**
 * Admin: Update ticket status (e.g. mark in_progress or update reply)
 * PUT /api/ri/support/admin/tickets/:id/status
 */
const updateTicketStatus = async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { status, admin_reply } = req.body;

    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const tCheck = await pool.query('SELECT * FROM ri_tickets WHERE id = $1', [ticketId]);
    if (tCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const currentTicket = tCheck.rows[0];
    const newStatus = status ? status.toLowerCase() : currentTicket.status;
    const newReply = admin_reply !== undefined ? admin_reply : currentTicket.admin_reply;

    await pool.query(`
      UPDATE ri_tickets
      SET status = $1, admin_reply = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newStatus, newReply, ticketId]);

    return res.json({
      success: true,
      message: `Ticket #RI-${ticketId} status updated to ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('[RI Support] Error updating ticket status:', err);
    return res.status(500).json({ success: false, message: 'Server error updating ticket.' });
  }
};

/**
 * Admin: Resolve an RI support ticket
 * PUT /api/ri/support/admin/tickets/:id/resolve
 */
const resolveTicket = async (req, res) => {
  try {
    const userRole = (req.user?.role || '').toLowerCase();
    if (userRole === 'superadmin_readonly' || userRole === 'superadmin_ri_readonly' || userRole === 'superadmin-ri-readonly') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Read-only super admins cannot resolve tickets.' });
    }

    const ticketId = Number(req.params.id);
    const { resolution } = req.body;

    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const cleanResolution = (resolution || '').trim();
    if (!cleanResolution) {
      return res.status(400).json({ success: false, message: 'Please provide a resolution note before resolving.' });
    }

    const tCheck = await pool.query('SELECT * FROM ri_tickets WHERE id = $1', [ticketId]);
    if (tCheck.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const ticket = tCheck.rows[0];
    const resolverName = req.user?.name || (userRole.includes('superadmin') ? 'RI Super Admin' : 'RI Admin');
    let resolverId = req.user?.id || null;
    if (resolverId) {
      const uExists = await pool.query('SELECT id FROM users WHERE id = $1', [resolverId]);
      if (uExists.rowCount === 0) {
        resolverId = null;
      }
    }
    const resolvedAt = new Date();

    await pool.query(`
      UPDATE ri_tickets
      SET 
        status = 'resolved',
        resolution = $1,
        resolved_by = $2,
        resolved_by_name = $3,
        resolved_at = $4,
        updated_at = $4
      WHERE id = $5
    `, [cleanResolution, resolverId, resolverName, resolvedAt, ticketId]);

    // Send non-blocking resolution email to original raiser
    sendRiTicketResolvedNotification({
      ticketId: ticket.id,
      raiserName: ticket.user_name,
      raiserEmail: ticket.user_email,
      subject: ticket.subject,
      description: ticket.description,
      resolution: cleanResolution,
      resolvedAt,
      batchName: ticket.batch_name,
      panelName: ticket.panel_name
    }).catch(err => {
      console.error('[RI Support Resolution Email Error]', err.message);
    });

    return res.json({
      success: true,
      message: `Ticket #RI-${ticketId} has been resolved successfully.`,
      resolved_at: resolvedAt,
      resolved_by_name: resolverName,
      resolution: cleanResolution
    });
  } catch (err) {
    console.error('[RI Support] Error resolving ticket:', err);
    return res.status(500).json({ success: false, message: 'Server error resolving ticket.' });
  }
};

/**
 * Admin: Get recent notifications and unread count
 * GET /api/ri/support/admin/notifications
 */
const getAdminNotifications = async (req, res) => {
  try {
    const notifsRes = await pool.query(`
      SELECT 
        id,
        title,
        message,
        type,
        target_role,
        is_read,
        metadata,
        created_at
      FROM ri_notifications
      WHERE target_role = 'admin'
      ORDER BY created_at DESC
      LIMIT 30
    `);

    const unreadCountRes = await pool.query(`
      SELECT COUNT(*)::int as count 
      FROM ri_notifications 
      WHERE target_role = 'admin' AND is_read = FALSE
    `);

    return res.json({
      success: true,
      notifications: notifsRes.rows,
      unreadCount: unreadCountRes.rows[0]?.count || 0
    });
  } catch (err) {
    console.error('[RI Support] Error getting admin notifications:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving notifications.' });
  }
};

/**
 * Admin: Mark notifications as read
 * POST /api/ri/support/admin/notifications/mark-read
 */
const markAdminNotificationsRead = async (req, res) => {
  try {
    const { notificationId } = req.body || {};

    if (notificationId) {
      await pool.query(`
        UPDATE ri_notifications
        SET is_read = TRUE
        WHERE id = $1 AND target_role = 'admin'
      `, [notificationId]);
    } else {
      await pool.query(`
        UPDATE ri_notifications
        SET is_read = TRUE
        WHERE target_role = 'admin' AND is_read = FALSE
      `);
    }

    return res.json({ success: true, message: 'Notifications marked as read.' });
  } catch (err) {
    console.error('[RI Support] Error marking notifications read:', err);
    return res.status(500).json({ success: false, message: 'Server error updating notifications.' });
  }
};

module.exports = {
  raiseTicket,
  getMyTickets,
  getAllRiTickets,
  updateTicketStatus,
  resolveTicket,
  getAdminNotifications,
  markAdminNotificationsRead
};
