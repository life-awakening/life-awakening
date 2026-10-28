const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const superadminController = require('../controllers/superadminController');
const whatsappController = require('../controllers/whatsappController');
const aiAnalysisController = require('../controllers/aiAnalysisController');
const ltcSummaryController = require('../controllers/ltcSummaryController');
const ltcReportController = require('../controllers/ltcReportController');
const laAdminController = require('../controllers/laAdminController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const memoryUpload = multer({ storage: multer.memoryStorage() });

// Faculty, LTC Member & Student master records
router.post('/faculty', authMiddleware(['admin']), adminController.createFaculty);
router.post('/ltc-member', authMiddleware(['admin']), adminController.createFaculty);
router.get('/students', authMiddleware(['admin']), adminController.getStudents);
router.get('/faculty-list', authMiddleware(['admin']), adminController.getFacultyList);
router.get('/filter-options', authMiddleware(['admin']), adminController.getFilterOptions);

// Batches
router.get('/batches', authMiddleware(['admin', 'superadmin', 'superadmin_readonly', 'dean_ltc']), adminController.getBatches);
router.post('/batches', authMiddleware(['admin']), adminController.createBatch);
router.put('/batches/:id', authMiddleware(['admin']), adminController.updateBatch);
router.delete('/batches/:id', authMiddleware(['admin']), adminController.deleteBatch);
router.post('/batches/:id/request-delete-otp', authMiddleware(['admin']), adminController.requestBatchDeleteOtp);
router.post('/batches/:id/verify-delete-otp', authMiddleware(['admin']), adminController.deleteBatch);
router.post('/batches/:id/restore', authMiddleware(['admin']), adminController.restoreBatch);
router.get('/batches/:id', authMiddleware(['admin']), adminController.getBatchDetails);
router.post('/batches/:id/send-orientation-email', authMiddleware(['admin']), adminController.sendOrientationEmail);
router.post('/send-manual-email', authMiddleware(['admin', 'superadmin']), adminController.sendManualEmail);
router.get('/batches/:id/orientation-recipients', authMiddleware(['admin']), adminController.getOrientationRecipients);
router.get('/sender-console/documents', authMiddleware(['admin', 'superadmin']), adminController.getSenderConsoleDocuments);
router.get('/sender-console/documents/:docId/content', authMiddleware(['admin', 'superadmin']), adminController.getSenderConsoleDocumentContent);
router.get('/communication/templates', authMiddleware(['admin', 'superadmin']), adminController.getCommunicationTemplates);
router.put('/communication/templates/:templateKey', authMiddleware(['admin', 'superadmin']), adminController.saveCommunicationTemplate);
router.delete('/communication/templates/:templateKey', authMiddleware(['admin', 'superadmin']), adminController.restoreCommunicationTemplateDefault);
router.get('/email-logs', authMiddleware(['admin', 'superadmin']), adminController.getEmailLogs);
router.post('/email-queue/retry', authMiddleware(['admin', 'superadmin']), adminController.retryFailedEmails);
router.post('/email-queue/retry/:id', authMiddleware(['admin', 'superadmin']), adminController.retrySingleEmail);
router.post('/email-queue/pause', authMiddleware(['admin', 'superadmin']), adminController.pauseEmailQueue);
router.post('/email-queue/resume', authMiddleware(['admin', 'superadmin']), adminController.resumeEmailQueue);
router.post('/email-queue/stop', authMiddleware(['admin', 'superadmin']), adminController.stopEmailQueue);
router.post('/email-queue/clear', authMiddleware(['admin', 'superadmin']), adminController.clearEmailQueue);

// WhatsApp Communication & Queue Management
router.post('/batches/:id/send-orientation-whatsapp', authMiddleware(['admin']), adminController.sendOrientationWhatsapp);
router.get('/whatsapp-logs', authMiddleware(['admin', 'superadmin']), adminController.getWhatsappLogs);
router.post('/whatsapp-queue/retry', authMiddleware(['admin', 'superadmin']), adminController.retryFailedWhatsapp);
router.post('/whatsapp-queue/retry/:id', authMiddleware(['admin', 'superadmin']), adminController.retrySingleWhatsapp);
router.post('/whatsapp-queue/pause', authMiddleware(['admin', 'superadmin']), adminController.pauseWhatsappQueue);
router.post('/whatsapp-queue/resume', authMiddleware(['admin', 'superadmin']), adminController.resumeWhatsappQueue);
router.post('/whatsapp-queue/stop', authMiddleware(['admin', 'superadmin']), adminController.stopWhatsappQueue);

// WhatsApp Campaigns
router.post('/whatsapp/send-lrp-welcome', authMiddleware(['admin']), whatsappController.sendLrpWelcomeCampaign);
router.get('/whatsapp/campaigns', authMiddleware(['admin', 'superadmin']), whatsappController.getRecentCampaigns);
router.get('/whatsapp/campaign/:campaignId/status', authMiddleware(['admin', 'superadmin']), whatsappController.getCampaignStatus);
router.get('/whatsapp/template-logs', authMiddleware(['admin', 'superadmin']), whatsappController.getTemplateLogs);
router.post('/whatsapp/media/upload', authMiddleware(['admin']), memoryUpload.single('file'), whatsappController.uploadMedia);

// Batch-Students
// ── Life Awakening school-student directory & mixed-class batch assignment ──
router.get('/la/students', authMiddleware(['admin']), laAdminController.getLaStudents);
router.get('/la/batches/:id/students', authMiddleware(['admin']), laAdminController.getLaBatchStudents);
router.post('/la/batches/:id/assign', authMiddleware(['admin']), laAdminController.assignLaStudentsToBatch);
router.get('/la/batch-conflicts', authMiddleware(['admin']), laAdminController.getLaBatchConflicts);

router.get('/batches/:id/students', authMiddleware(['admin']), adminController.getBatchStudents);
router.get('/batches/:id/export-students', authMiddleware(['admin', 'superadmin']), adminController.getBatchStudentsExport);
router.get('/batches/:id/hard-copy-pdf', authMiddleware(['admin', 'superadmin']), adminController.getBatchHardCopyPdf);
router.get('/batches/:id/attendance-erp-excel', authMiddleware(['admin', 'superadmin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), adminController.getBatchAttendanceErpExcel);
router.get('/batch-summary-pdf/:batchId', authMiddleware(['admin', 'superadmin', 'superadmin_readonly', 'dean_ltc']), ltcReportController.generateLtcTemplatePdf);
router.get('/batches/:id/summary-pdf', authMiddleware(['admin', 'superadmin', 'superadmin_readonly', 'dean_ltc']), ltcReportController.generateLtcTemplatePdf);
router.post('/batches/:id/students', authMiddleware(['admin']), adminController.addBatchStudents);
router.delete('/batches/:id/students/:studentId', authMiddleware(['admin']), adminController.removeBatchStudent);
router.post('/batches/:id/students/add-one', authMiddleware(['admin']), adminController.addOneBatchStudent);

// Batch Absentees Snapshot
router.get('/batches/:id/absentees-snapshot', authMiddleware(['admin', 'superadmin']), adminController.getBatchAbsenteesSnapshot);
router.post('/batches/:id/absentees-snapshot', authMiddleware(['admin']), adminController.saveBatchAbsenteesSnapshot);
router.put('/students/:id/lock', authMiddleware(['admin', 'superadmin']), adminController.lockStudentAccount);

// Batch-Faculty
router.get('/batches/:id/faculty', authMiddleware(['admin']), adminController.getBatchFaculty);
router.post('/batches/:id/faculty', authMiddleware(['admin']), adminController.addBatchFaculty);
router.post('/batches/:id/faculty/bulk-verify', authMiddleware(['admin']), adminController.bulkVerifyBatchFaculty);
router.delete('/batches/:id/faculty/:facultyId', authMiddleware(['admin']), adminController.removeBatchFaculty);

// Bulk upload and enrollment inside a batch
router.post('/batches/:id/bulk-upload', authMiddleware(['admin']), upload.single('file'), adminController.batchBulkUpload);
router.post('/batches/:id/enroll-existing', express.json({ limit: '10mb' }), authMiddleware(['admin']), adminController.enrollExistingBatchUsers);
router.post('/batches/:id/assign-hierarchy', authMiddleware(['admin']), adminController.assignHierarchyToBatch);

// Red Flags
router.get('/red-flags', authMiddleware(['admin']), adminController.getRedFlags);

// Squad management inside a batch
router.get('/batches/:id/squads', authMiddleware(['admin']), adminController.getBatchSquads);
router.get('/batches/:id/students-breakdown', authMiddleware(['admin']), adminController.getBatchStudentsBreakdown);
router.post('/batches/:id/auto-allocate-squads', authMiddleware(['admin']), adminController.autoAllocateBatchSquads);
router.post('/batches/:id/auto-allocate-rooms', authMiddleware(['admin']), adminController.autoAllocateBatchRooms);
router.put('/batches/:id/student-squad', authMiddleware(['admin']), adminController.updateBatchStudentSquad);
router.get('/batches/:id/available-rooms', authMiddleware(['admin']), adminController.getAvailableBatchRooms);
router.get('/batches/:id/unavailable-rooms', authMiddleware(['admin', 'superadmin']), adminController.getBatchUnavailableRooms);
router.put('/batches/:id/unavailable-rooms', authMiddleware(['admin', 'superadmin']), adminController.updateBatchUnavailableRooms);
router.put('/batches/:id/students/:studentId/room', authMiddleware(['admin']), adminController.updateStudentRoom);
router.put('/batches/:id/faculty-squad', authMiddleware(['admin']), adminController.updateBatchFacultySquad);
router.post('/batches/:id/lock-squads', authMiddleware(['admin']), adminController.lockBatchSquads);
router.post('/batches/:id/notify-squads', authMiddleware(['admin']), adminController.notifyBatchSquads);

// Dashboard and generic admin actions
router.get('/dashboard', authMiddleware(['admin']), adminController.getDashboard);
router.get('/users', authMiddleware(['admin']), adminController.getUsers);
router.put('/update-panel', authMiddleware(['admin']), adminController.updatePanel);
router.put('/update-division', authMiddleware(['admin']), adminController.updateDivision);
router.put('/insurance', authMiddleware(['admin']), adminController.updateInsurance);
router.post('/bulk-upload/validate', authMiddleware(['admin']), upload.single('file'), adminController.validateBulkUpload);
router.post('/bulk-upload', authMiddleware(['admin']), upload.single('file'), adminController.globalBulkUpload);
router.get('/upload-jobs/:jobId', authMiddleware(['admin']), adminController.getUploadJobStatus);
router.get('/users/:id/profile', authMiddleware(['admin', 'superadmin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), adminController.getUserProfile);
router.put('/users/:id/profile', authMiddleware(['admin', 'superadmin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']), adminController.updateUserProfile);
router.post('/upload-file', authMiddleware(['admin', 'superadmin', 'superadmin_readonly', 'support']), memoryUpload.single('file'), adminController.uploadAdminFile);
router.post('/auto-allocate', authMiddleware(['admin']), adminController.autoAllocateRoomsSquads);
router.post('/bulk-insurance', authMiddleware(['admin']), upload.single('file'), adminController.bulkInsurance);
router.post('/insurance-bulk-upload', authMiddleware(['admin']), upload.single('file'), adminController.bulkInsurance);
router.get('/user-by-barcode', authMiddleware(['admin', 'faculty', 'ltc_member']), adminController.getUserByBarcode);
router.get('/feedback', authMiddleware(['admin']), adminController.getFeedback);
router.post('/ai-form-analysis', authMiddleware(['admin', 'superadmin', 'superadmin_readonly']), aiAnalysisController.generateAiFormAnalysis);
router.post('/ai-form-analysis/chat', authMiddleware(['admin', 'superadmin', 'superadmin_readonly']), aiAnalysisController.chatWithFeedbackData);
router.get('/audit-logs', authMiddleware(['admin', 'superadmin']), adminController.getAuditLogs);
router.delete('/users/:id', authMiddleware(['admin']), adminController.deleteUser);
router.post('/hierarchy/preview', authMiddleware(['admin']), adminController.previewHierarchy);

// Current active batch (legacy/global)
router.get('/current-batch', authMiddleware(['admin']), adminController.getCurrentBatch);
router.post('/set-current-batch', authMiddleware(['admin']), adminController.setCurrentBatch);
router.put('/toggle-student-batch', authMiddleware(['admin']), adminController.toggleStudentBatch);
router.post('/clear-current-batch', authMiddleware(['admin']), adminController.clearCurrentBatch);
router.get('/squad-allocation-state', authMiddleware(['admin']), adminController.getSquadAllocationState);
router.post('/lock-squads', authMiddleware(['admin']), adminController.lockSquads);
router.post('/unlock-squads', authMiddleware(['admin']), adminController.unlockSquads);
router.post('/shuffle-squads', authMiddleware(['admin']), adminController.shuffleSquads);
router.get('/journey-media', authMiddleware(['admin', 'superadmin', 'gallery']), adminController.getAllJourneyMedia);
router.delete('/journey-media/:id', authMiddleware(['admin']), adminController.deleteJourneyMedia);
router.get('/batch-group-photos/:batchId', authMiddleware(['admin', 'superadmin', 'superadmin_readonly', 'dean_ltc', 'gallery']), superadminController.getBatchGroupPhotos);
router.post('/batch-group-photos', authMiddleware(['admin', 'superadmin', 'superadmin_readonly']), memoryUpload.single('file'), superadminController.uploadBatchGroupPhoto);
router.delete('/batch-group-photos/:id', authMiddleware(['admin', 'superadmin', 'superadmin_readonly']), superadminController.deleteBatchGroupPhoto);

router.post('/translations', authMiddleware(['admin', 'superadmin']), adminController.updateTranslation);
router.delete('/translations/:key', authMiddleware(['admin', 'superadmin']), adminController.deleteTranslation);

router.get('/global-search', authMiddleware(['admin', 'superadmin']), adminController.globalSearch);
router.get('/reports/:type', authMiddleware(['admin']), superadminController.generateReport);

// Squad Performance & 5-Day Grading routes
const squadGradingController = require('../controllers/squadGradingController');
router.get('/squad-performance', authMiddleware(['admin', 'superadmin']), squadGradingController.getSquadPerformance);
router.post('/squad-performance/grade', authMiddleware(['admin', 'superadmin']), squadGradingController.recordSquadGrading);
router.post('/squad-performance/status', authMiddleware(['admin', 'superadmin']), squadGradingController.toggleResultStatus);
router.get('/squad-performance/audit', authMiddleware(['admin', 'superadmin']), squadGradingController.getSquadPerformanceAudit);

module.exports = router;
