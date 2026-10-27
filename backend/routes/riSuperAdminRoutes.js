const express = require('express');
const router = express.Router();
const riSuperAdminController = require('../controllers/riSuperAdminController');
const authMiddleware = require('../middleware/auth');

// Restrict all RI Super Admin routes to superadmin-ri, superadmin, ri_admin, and read-only superadmins (GET only)
router.use(authMiddleware(['superadmin-ri', 'superadmin', 'superadmin_ri_readonly', 'superadmin-ri-readonly', 'ri_admin']));

// 1. Executive Overview & Analytics
router.get('/analytics', riSuperAdminController.getRiSuperAdminAnalytics);

// 2. All RI Batches with rich statistics
router.get('/batches', riSuperAdminController.getRiSuperAdminBatches);
router.post('/batches', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.createRiSuperAdminBatch);
router.put('/batches/:id', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.updateRiSuperAdminBatch);
router.post('/batches/:id/lock', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.lockRiBatch);
router.post('/batches/:id/unlock', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.unlockRiBatch);
router.post('/batches/:id/archive', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.archiveRiBatch);
router.post('/batches/:id/close', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.closeRiBatch);
router.post('/batches/:id/reopen', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.reopenRiBatch);
router.get('/batches/:id/export-csv', riSuperAdminController.exportRiBatchCsv);
router.get('/batches/:id/export', riSuperAdminController.exportRiBatchCsv);
router.get('/batches/:id/hard-copy-pdf', riSuperAdminController.getRiBatchHardCopyPdf);

// 3. Comprehensive Batch Detail Drilldown
router.get('/batches/:id/details', riSuperAdminController.getRiSuperAdminBatchDetails);

// 4. Panel & Faculty Mapping (with multiple faculty per panel)
router.get('/panel-faculty-mapping', riSuperAdminController.getPanelFacultyMapping);

// 5. Faculty Management Directory
router.get('/faculty-management', riSuperAdminController.getFacultyManagement);

// 6. Global Search & Filters
router.get('/search', riSuperAdminController.searchRiSuperAdminEntities);

// 7. Multi-Sheet Batch Summary Excel Export
router.get('/batches/:id/export-summary', riSuperAdminController.exportBatchSummaryExcel);

// 8. Read-Only Super Admins IAM Management (Mutations restricted to full Super Admin)
router.get('/readonly-admins', riSuperAdminController.getRiReadOnlySuperAdmins);
router.post('/readonly-admins', authMiddleware(['superadmin-ri', 'superadmin']), riSuperAdminController.createRiReadOnlySuperAdmin);
router.delete('/readonly-admins/:id', authMiddleware(['superadmin-ri', 'superadmin']), riSuperAdminController.deleteRiReadOnlySuperAdmin);

// 9. Account Security — Change Password (Accessible strictly to read-only super admins)
router.post('/change-password', authMiddleware(['superadmin_ri_readonly', 'superadmin-ri-readonly']), riSuperAdminController.changeRiSuperAdminPassword);

// 10. Superadmin Attendance Management Endpoints
router.get('/attendance/panels', riSuperAdminController.getBatchAttendancePanels);
router.get('/attendance/panel-detail', riSuperAdminController.getPanelAttendanceDetail);
router.post('/attendance/panel-save', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.savePanelAttendanceAdmin);
router.post('/attendance/toggle-lock', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.togglePanelAttendanceLock);

// 11. Superadmin Evaluation Management Endpoints
router.get('/evaluations/panels', riSuperAdminController.getBatchEvaluationPanels);
router.get('/evaluations/panel-detail', riSuperAdminController.getPanelEvaluationDetail);
router.post('/evaluations/panel-save', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.savePanelEvaluationAdmin);
router.post('/evaluations/toggle-lock', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.togglePanelEvaluationLock);
router.post('/evaluations/unlock-single', authMiddleware(['superadmin-ri', 'superadmin', 'ri_admin']), riSuperAdminController.unlockSingleStudentEvaluationAdmin);

module.exports = router;
