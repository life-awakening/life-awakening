const express = require('express');
const router = express.Router();
const riRedFlagController = require('../controllers/riRedFlagController');
const riFacultyAuth = require('../middleware/riFacultyAuth');
const authMiddleware = require('../middleware/auth');

// ── Faculty Scope (Requires riFacultyAuth) ──
router.get('/faculty/students', riFacultyAuth, riRedFlagController.getFacultyStudents);
router.post('/faculty/raise', riFacultyAuth, riRedFlagController.raiseFacultyRedFlag);
router.get('/faculty/my-flags', riFacultyAuth, riRedFlagController.getMyFacultyRedFlags);

// ── Admin & Super Admin Scope ──
const adminRoles = ['ri_admin', 'superadmin-ri', 'superadmin', 'superadmin_ri_readonly', 'superadmin-ri-readonly', 'admin'];

router.get('/admin/all', authMiddleware(adminRoles), riRedFlagController.getAllRedFlags);
router.patch('/admin/:id/status', authMiddleware(adminRoles), riRedFlagController.updateRedFlagStatus);
router.get('/admin/export', authMiddleware(adminRoles), riRedFlagController.downloadRedFlagsExcel);

module.exports = router;
