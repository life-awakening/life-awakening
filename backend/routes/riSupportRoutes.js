const express = require('express');
const router = express.Router();
const riSupportController = require('../controllers/riSupportController');
const authMiddleware = require('../middleware/auth');

// ── Student & Faculty Endpoints (Raise & View Own Tickets) ──
router.post(
  '/tickets',
  authMiddleware(['student', 'faculty', 'ri_student', 'ri_faculty', 'admin', 'superadmin', 'superadmin-ri']),
  riSupportController.raiseTicket
);

router.get(
  '/my-tickets',
  authMiddleware(['student', 'faculty', 'ri_student', 'ri_faculty', 'admin', 'superadmin', 'superadmin-ri']),
  riSupportController.getMyTickets
);

// ── RI Admin Endpoints (Manage All RI Tickets & Notifications) ──
router.get(
  '/admin/tickets',
  authMiddleware(['ri_admin', 'admin', 'superadmin', 'superadmin-ri', 'superadmin_ri_readonly', 'superadmin-ri-readonly']),
  riSupportController.getAllRiTickets
);

router.put(
  '/admin/tickets/:id/status',
  authMiddleware(['ri_admin', 'admin', 'superadmin', 'superadmin-ri']),
  riSupportController.updateTicketStatus
);

router.put(
  '/admin/tickets/:id/resolve',
  authMiddleware(['ri_admin', 'admin', 'superadmin', 'superadmin-ri']),
  riSupportController.resolveTicket
);

router.get(
  '/admin/notifications',
  authMiddleware(['ri_admin', 'admin', 'superadmin', 'superadmin-ri', 'superadmin_ri_readonly', 'superadmin-ri-readonly']),
  riSupportController.getAdminNotifications
);

router.post(
  '/admin/notifications/mark-read',
  authMiddleware(['ri_admin', 'admin', 'superadmin', 'superadmin-ri']),
  riSupportController.markAdminNotificationsRead
);

module.exports = router;
