const express = require('express');
const router = express.Router();
const multer = require('multer');
const riController = require('../controllers/riController');
const authMiddleware = require('../middleware/auth');

// Multer memory storage for spreadsheet uploads (.xlsx, .xls, .csv)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Protect all RI Admin routes with authMiddleware (Allow ri_admin, admin, superadmin, superadmin-ri, and read-only superadmins for GET)
router.use(authMiddleware(['ri_admin', 'admin', 'superadmin', 'superadmin-ri', 'superadmin_ri_readonly', 'superadmin-ri-readonly']));

// Dashboard stats
router.get('/stats', riController.getDashboardStats);

// LTC Batches available for RI
router.get('/ltc-batches', riController.getLtcBatches);

// RI Batches
router.get('/batches', riController.getRiBatches);
router.post('/batches', riController.createRiBatch);
router.get('/batches/:id', riController.getRiBatchById);
router.put('/batches/:id', riController.updateRiBatch);
router.delete('/batches/:id', riController.deleteRiBatch);
router.post('/batches/:id/sync', riController.syncLtcBatchToRi);
router.get('/batches/:id/panels', riController.getBatchPanels);
router.get('/batches/:id/nodal-officers', riController.getBatchNodalOfficers);

// Village Management for Batches
router.get('/villages', riController.getAllVillages);
router.get('/batches/:id/villages', riController.getBatchVillages);
router.post('/batches/:id/villages', riController.createBatchVillage);
router.put('/villages/:villageId', riController.updateVillage);
router.delete('/villages/:villageId', riController.deleteVillage);

// Panel -> Village Allocation & Nodal Officer Mapping
router.put('/panels/:panelId/village', riController.assignPanelVillage);
router.put('/panels/:panelId/nodal-officer', riController.updatePanelNodalOfficer);
router.put('/batches/:id/panel-village-allocations', riController.bulkAssignPanelsVillages);

// RI Panels
router.get('/panels/:id/students', riController.getPanelStudents);
router.delete('/panels/:panelId', riController.deletePanel);
router.delete('/batches/:id/panels/:panelId', riController.deletePanel);

// Faculty / Mentor Management & Bulk Upload
router.get('/batches/:id/faculty', riController.getBatchFaculty);
router.post('/batches/:id/faculty/validate-upload', upload.single('file'), riController.validateFacultyUpload);
router.post('/batches/:id/faculty/validate', upload.single('file'), riController.validateFacultyUpload);
router.post('/batches/:id/faculty/bulk-upload', upload.single('file'), riController.bulkUploadFaculty);
router.post('/batches/:id/village-faculty/validate', upload.single('file'), riController.validateVillageFacultyUpload);
router.post('/batches/:id/village-faculty/import', upload.single('file'), riController.importVillageFacultyUpload);
router.get('/batches/:id/village-faculty/template', riController.downloadVillageFacultyTemplate);
router.get('/batches/:id/faculty/template', riController.downloadFacultyTemplate);
router.post('/batches/:id/faculty', riController.createBatchFaculty);
router.put('/faculty/:facultyId', riController.updateBatchFaculty);
router.delete('/faculty/:facultyId', riController.deleteBatchFaculty);
router.get('/faculty/:facultyId/undertaking-pdf', riController.downloadFacultyUndertakingPdf);

// All RI Students & Student Bulk Upload
router.get('/students', riController.getAllRiStudents);
router.post('/batches/:id/students', riController.createRiStudent);
router.put('/students/:id', riController.updateRiStudent);
router.post('/batches/:id/students/validate-upload', upload.single('file'), riController.validateStudentUpload);
router.post('/batches/:id/students/validate', upload.single('file'), riController.validateStudentUpload);
router.post('/batches/:id/students/bulk-upload', upload.single('file'), riController.bulkUploadStudents);
router.get('/batches/:id/students/template', riController.downloadStudentTemplate);

// RI Admin & Super Admin Reports & Multi-Sheet Excel Exports
router.get('/reports/attendance', riController.getAdminAttendanceReport);
router.get('/reports/forms', riController.getAdminStudentFormsReport);
router.get('/reports/evaluation', riController.getAdminEvaluationReport);
router.get('/reports/family-survey', riController.getAdminFamilySurveyReport);
router.get('/reports/overall-assessment', riController.getAdminOverallAssessmentReport);
router.get('/reports/audit-logs', riController.getAdminAuditLogs);

// RI Admin Submissions Tracking
router.get('/submissions', riController.getAdminSubmissions);
router.get('/submissions/student/:studentId', riController.getAdminStudentSubmissionDetail);

// RI Communication Module (Sender Console & Email Audit Logs)
const riCommunicationController = require('../controllers/riCommunicationController');
router.get('/communication/batches', riCommunicationController.getRiBatchesForCommunication);
router.get('/communication/recipients', riCommunicationController.getRiBatchRecipients);
router.post('/communication/send', riCommunicationController.sendRiEmail);
router.get('/communication/logs', riCommunicationController.getRiEmailLogs);

// RI Visit Media (Admin / Super Admin viewing & moderation)
router.get('/panels/:panelId/media', riController.getPanelMediaAdmin);
router.get('/media', riController.getPanelMediaAdmin);
router.delete('/media/:id', riController.deletePanelMediaAdmin);

// RI Faculty Uploads (Admin / Super Admin viewing & moderation batch-wise & village-wise)
router.get('/faculty-uploads', riController.getFacultyUploadsAdmin);
router.delete('/faculty-uploads/:id', riController.deletePanelMediaAdmin);

module.exports = router;


