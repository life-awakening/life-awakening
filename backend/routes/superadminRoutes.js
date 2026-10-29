const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const superadminController = require('../controllers/superadminController');
const adminController = require('../controllers/adminController');
const databaseResetController = require('../controllers/databaseResetController');
const ltcSummaryController = require('../controllers/ltcSummaryController');
const ltcReportController = require('../controllers/ltcReportController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

// All routes are strictly restricted to role 'superadmin'
router.get('/users', authMiddleware(['superadmin']), superadminController.getUsers);
router.post('/users', authMiddleware(['superadmin']), superadminController.createUser);
router.get('/users/:id/profile', authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), adminController.getUserProfile);
router.put('/users/:id/profile', authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), adminController.updateUserProfile);
router.put('/users/:id', authMiddleware(['superadmin']), superadminController.updateUser);
router.delete('/users/:id', authMiddleware(['superadmin']), superadminController.deleteUser);
router.post('/users/:id/reset-password', authMiddleware(['superadmin']), superadminController.resetUserPassword);
router.put('/users/:id/lock', authMiddleware(['superadmin']), superadminController.toggleUserLock);
router.put('/users/:id/status', authMiddleware(['superadmin']), superadminController.toggleUserStatus);
router.put('/users/:id/permissions', authMiddleware(['superadmin']), superadminController.updateUserPermissions);
router.get('/role-permissions', authMiddleware(['superadmin']), superadminController.getRolePermissions);
router.put('/role-permissions', authMiddleware(['superadmin']), superadminController.updateRolePermissions);

router.get('/health', authMiddleware(['superadmin']), superadminController.getSystemHealth);
router.get('/active-sessions', authMiddleware(['superadmin']), superadminController.getActiveSessions);
router.get('/config', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getSystemSettings);
router.put('/config', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.updateSystemSettings);
router.get('/diagnostics', authMiddleware(['superadmin']), superadminController.getServerDiagnostics);
router.post('/backup', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.backupDatabase);
router.post('/backup-binary', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.backupBinaryDatabase);
router.post('/purge', authMiddleware(['superadmin']), superadminController.purgeDatabase);
// Secure Database Reset Routes (Strict Full Super Admin Only)
router.post('/reset-database/request-otp', authMiddleware(['superadmin']), databaseResetController.requestResetOtp);
router.post('/reset-database/verify-otp', authMiddleware(['superadmin']), databaseResetController.verifyResetOtp);
router.post('/reset-database', authMiddleware(['superadmin']), databaseResetController.executeDatabaseReset);

// Analytics routes
router.get('/analytics/executive-dashboard', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getExecutiveDashboard);
router.get('/analytics/batch-summary', authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), superadminController.getBatchSummary);
router.get('/analytics/attendance-trends', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getAttendanceTrends);
router.get('/analytics/evaluation-trends', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getEvaluationTrends);
router.get('/analytics/feedback-summary', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getFeedbackSummary);
router.get('/analytics/batch-roster', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getBatchRoster);
router.get('/analytics/squad-attendance-summary', authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), superadminController.getSquadAttendanceSummary);
router.get('/batch-summary-pdf/:batchId', authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), ltcReportController.generateLtcTemplatePdf);

// Batch Management routes
router.get('/batches', authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'gallery']), superadminController.getSuperAdminBatches);
router.post('/batches', authMiddleware(['superadmin']), superadminController.createSuperAdminBatch);
router.put('/batches/:id', authMiddleware(['superadmin']), superadminController.updateSuperAdminBatch);
router.post('/batches/:id/archive', authMiddleware(['superadmin']), superadminController.archiveSuperAdminBatch);
router.post('/batches/:id/close', authMiddleware(['superadmin']), superadminController.closeSuperAdminBatch);
router.post('/batches/:id/reopen', authMiddleware(['superadmin']), superadminController.reopenSuperAdminBatch);
router.post('/batches/:id/lock', authMiddleware(['superadmin']), superadminController.lockSuperAdminBatch);
router.post('/batches/:id/unlock', authMiddleware(['superadmin']), superadminController.unlockSuperAdminBatch);
router.post('/batches/:id/lock-feedback', authMiddleware(['superadmin', 'admin']), superadminController.lockBatchFeedback);
router.post('/batches/:id/unlock-feedback', authMiddleware(['superadmin', 'admin']), superadminController.unlockBatchFeedback);
router.post('/batches/:id/toggle-feedback-lock', authMiddleware(['superadmin', 'admin']), superadminController.toggleBatchFeedbackLock);
router.post('/batches/clone', authMiddleware(['superadmin']), superadminController.cloneSuperAdminBatch);
router.post('/batches/merge', authMiddleware(['superadmin']), superadminController.mergeSuperAdminBatches);
router.get('/batches/:id/export', authMiddleware(['superadmin']), superadminController.exportSuperAdminBatch);

// Reports & Analytics routes
router.get('/reports/:type', authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), superadminController.generateReport);

// Email Management routes
router.get('/emails/templates', authMiddleware(['superadmin']), superadminController.getEmailTemplates);
router.post('/emails/templates', authMiddleware(['superadmin']), superadminController.createEmailTemplate);
router.put('/emails/templates/:id', authMiddleware(['superadmin']), superadminController.updateEmailTemplate);
router.delete('/emails/templates/:id', authMiddleware(['superadmin']), superadminController.deleteEmailTemplate);
router.post('/emails/schedule', authMiddleware(['superadmin']), superadminController.scheduleEmails);
router.post('/emails/resend', authMiddleware(['superadmin']), superadminController.resendFailedEmails);
router.get('/emails/history', authMiddleware(['superadmin']), superadminController.getEmailHistory);
router.get('/emails/delivery-report', authMiddleware(['superadmin']), superadminController.getEmailDeliveryReport);

// Notification Center routes
router.post('/notifications/send', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.sendNotification);
router.get('/notifications', authMiddleware(['superadmin']), superadminController.getNotifications);
router.get('/notifications/stats', authMiddleware(['superadmin']), superadminController.getNotificationStats);
router.get('/notifications/me', authMiddleware(['superadmin','superadmin_readonly','admin','faculty','ltc_member','student','parent']), superadminController.getUserNotifications);
router.post('/notifications/read', authMiddleware(['superadmin','superadmin_readonly','admin','faculty','ltc_member','student','parent']), superadminController.markNotificationsRead);

// Read-Only Super Admin Management Routes (Main Super Admin Only)
router.get('/readonly-users', authMiddleware(['superadmin']), superadminController.getReadonlySuperAdmins);
router.get('/eligible-readonly-candidates', authMiddleware(['superadmin']), superadminController.getEligibleReadonlyCandidates);
router.post('/assign-readonly', authMiddleware(['superadmin']), superadminController.assignReadonlySuperAdmin);
router.delete('/remove-readonly/:id', authMiddleware(['superadmin']), superadminController.removeReadonlySuperAdmin);

// New Feedback, Red Flag, Attendance & File Management Routes
router.get('/feedback-analytics', authMiddleware(['superadmin']), superadminController.getFeedbackAnalytics);

router.get('/red-flags-control', authMiddleware(['superadmin']), superadminController.getAdminRedFlags);
router.get('/red-flags/:id', authMiddleware(['superadmin']), superadminController.getRedFlagDetails);
router.post('/red-flags/:id/assign', authMiddleware(['superadmin']), superadminController.assignRedFlag);
router.post('/red-flags/:id/resolve', authMiddleware(['superadmin']), superadminController.resolveRedFlag);
router.post('/red-flags/:id/reopen', authMiddleware(['superadmin']), superadminController.reopenRedFlag);
router.post('/red-flags/:id/comments', authMiddleware(['superadmin']), superadminController.addRedFlagComment);

router.get('/attendance-analytics', authMiddleware(['superadmin']), superadminController.getAttendanceAnalytics);
router.get('/locked-status', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getLockedStatus);
router.get('/attendance/squad-activity', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getSquadActivityAttendance);
router.post('/attendance/squad-activity', authMiddleware(['superadmin']), superadminController.updateSquadActivityAttendance);
router.post('/attendance/squad-activity/unlock', authMiddleware(['superadmin']), superadminController.unlockSquadActivityAttendance);

router.get('/files', authMiddleware(['superadmin']), superadminController.getFiles);
router.post('/files/:id/new-version', authMiddleware(['superadmin']), superadminController.uploadFileVersion);
router.get('/files/:id/versions', authMiddleware(['superadmin']), superadminController.getFileVersions);
router.delete('/files/:id', authMiddleware(['superadmin']), superadminController.deleteFile);

// Certificate Management routes
router.post('/certificates', authMiddleware(['superadmin', 'admin', 'superadmin_readonly']), superadminController.uploadCertificate);
router.post('/certificates/allocate-category', authMiddleware(['superadmin', 'admin', 'superadmin_readonly']), superadminController.allocateCategoryCertificate);
router.get('/certificates', authMiddleware(['superadmin', 'admin', 'superadmin_readonly']), superadminController.getAllCertificates);
router.get('/best-squad-coordinators', authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'faculty', 'ltc_member']), superadminController.getBestSquadCoordinatorsLeaderboard);
router.post('/best-squad-coordinators/assign', authMiddleware(['superadmin', 'admin', 'superadmin_readonly']), superadminController.assignBestSquad);

// Performance Admin Management routes (Assign Fall In, Yoga, Agriculture roles to Faculty & LTC Members)
router.get('/performance-admins', authMiddleware(['superadmin']), superadminController.getPerformanceAdmins);
router.post('/performance-admins/assign', authMiddleware(['superadmin']), superadminController.assignPerformanceRoles);
router.post('/performance-admins/remove', authMiddleware(['superadmin']), superadminController.removePerformanceRole);

// Pre/Post Admin Delegation routes for LTC Members
router.get('/pre-post-admin', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getPrePostAdmins);
router.post('/pre-post-admin/select', authMiddleware(['superadmin']), superadminController.selectPrePostAdmin);

// Squad Performance routes (Isolated Feature)
router.get('/squad-performance', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.getSquadPerformance);
router.post('/squad-performance/select', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.recordSquadPerformanceSelection);
router.post('/squad-performance/save-activity', authMiddleware(['superadmin', 'superadmin_readonly', 'faculty', 'ltc_member']), superadminController.saveSquadPerformanceActivity);
router.post('/squad-performance/reset-activity', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.resetSquadPerformanceActivity);
router.post('/squad-performance/reset-all', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.resetAllSquadPerformance);
router.post('/squad-performance/toggle-lock', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.toggleSquadPerformanceLock);
router.get('/squad-performance/export-excel', authMiddleware(['superadmin', 'superadmin_readonly']), superadminController.exportSquadPerformanceExcel);

// AI Form Analysis route
const aiAnalysisController = require('../controllers/aiAnalysisController');
const ltcChatbotController = require('../controllers/ltcChatbotController');
router.post('/ai-form-analysis', authMiddleware(['superadmin', 'superadmin_readonly', 'admin', 'support', 'jeeten']), aiAnalysisController.generateAiFormAnalysis);
router.post('/ai-form-analysis/chat', authMiddleware(['superadmin', 'superadmin_readonly', 'admin', 'support', 'jeeten']), aiAnalysisController.chatWithFeedbackData);
router.post('/chatbot/chat', authMiddleware(['superadmin', 'superadmin_readonly', 'admin']), ltcChatbotController.chatWithLtcDatabase);

// Batch Group Photos routes (Superadmin, Read-only Superadmin, Admin, Dean LTC, Faculty, LTC Member, Coordinator & Student)
router.get('/batch-group-photos/summary', authMiddleware(['superadmin', 'superadmin_readonly', 'admin', 'dean_ltc', 'faculty', 'ltc_member', 'coordinator', 'ltc_coordinator', 'squad_coordinator', 'gallery']), superadminController.getBatchGroupPhotosSummary);
router.get('/batch-group-photos/:batchId', (req, res, next) => {
  const authHeader = req.headers.authorization || (req.query?.token ? `Bearer ${req.query.token}` : null);
  if (!authHeader) {
    return next();
  }
  try {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (_) {
    // If token is invalid or expired, continue to allow reading group photos
  }
  next();
}, superadminController.getBatchGroupPhotos);
router.post('/batch-group-photos/presigned-url', authMiddleware(['superadmin', 'superadmin_readonly', 'admin']), superadminController.getBatchGroupPhotoPresignedUrl);
router.post('/batch-group-photos', authMiddleware(['superadmin', 'superadmin_readonly', 'admin']), upload.single('file'), superadminController.uploadBatchGroupPhoto);
router.delete('/batch-group-photos/:id', authMiddleware(['superadmin', 'superadmin_readonly', 'admin']), superadminController.deleteBatchGroupPhoto);

module.exports = router;


