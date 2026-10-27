const express = require('express');
const router = express.Router();
const generalController = require('../controllers/generalController');
const riWorkspaceController = require('../controllers/riWorkspaceController');
const authMiddleware = require('../middleware/auth');

// RI Workspace Selection endpoint for multi-assigned faculty / nodal officers
router.get('/ri/workspaces/my-assignments', authMiddleware(), riWorkspaceController.getMyWorkspaces);

router.get('/media/file', generalController.serveMediaFile);
router.get('/verify', generalController.verifyBarcode);
router.post('/documents', authMiddleware(['admin', 'faculty', 'superadmin']), generalController.uploadDocument);
router.delete('/documents/:id', authMiddleware(['admin', 'superadmin']), generalController.deleteDocument);
router.get('/documents', authMiddleware(), generalController.getDocuments);
router.get('/schedules', authMiddleware(), generalController.getSchedules);
router.get('/active-batch', authMiddleware(), generalController.getActiveBatch);
router.get('/announcement', authMiddleware(), generalController.getAnnouncementBanner);
router.get('/dashboard-stats', authMiddleware(), generalController.getDashboardStats);
router.get('/me', authMiddleware(), generalController.getProfile);
router.put('/me', authMiddleware(), generalController.updateProfile);
router.post('/feedback', authMiddleware(['student', 'parent', 'faculty', 'ltc_member']), generalController.submitFeedback);
router.get('/feedback/my-submissions', authMiddleware(['student', 'parent', 'faculty', 'ltc_member']), generalController.getMyFeedbackSubmissions);
router.post('/feedback/google-webhook', generalController.submitGoogleFeedbackWebhook);
router.get('/test-email', authMiddleware(['superadmin']), generalController.testEmail);

// Ticket endpoints
router.post('/tickets', authMiddleware(['student', 'parent', 'faculty', 'ltc_member']), generalController.raiseTicket);
router.get('/tickets/my-tickets', authMiddleware(['student', 'parent', 'faculty', 'ltc_member']), generalController.getMyTickets);
router.get('/tickets/all', authMiddleware(['admin', 'superadmin']), generalController.getAllTickets);
router.put('/tickets/:id/resolve', authMiddleware(['admin', 'superadmin']), generalController.resolveTicket);

router.get('/translations', generalController.getTranslations);

// Certificate route
router.get('/certificates/my-certificates', authMiddleware(['student', 'parent', 'faculty', 'ltc_member', 'admin', 'superadmin']), generalController.getMyCertificates);
router.get('/certificates/download/:id', generalController.downloadCertificate);

module.exports = router;
