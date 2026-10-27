const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const authMiddleware = require('../middleware/auth');

const passwordOtpController = require('../controllers/passwordOtpController');

router.post('/submit-undertaking', authMiddleware(['faculty', 'ltc_member']), facultyController.submitUndertaking);
router.get('/dashboard', authMiddleware(['faculty', 'ltc_member']), facultyController.getDashboard);
router.post('/add-red-flag', authMiddleware(['faculty', 'ltc_member']), facultyController.addRedFlag);
router.post('/schedule', authMiddleware(['faculty', 'ltc_member']), facultyController.createSchedule);
router.delete('/schedule/:id', authMiddleware(['faculty', 'ltc_member']), facultyController.deleteSchedule);
router.post('/evaluate', authMiddleware(['admin', 'faculty', 'ltc_member']), facultyController.submitEvaluation);
router.get('/evaluations', authMiddleware(['admin', 'faculty', 'ltc_member']), facultyController.getEvaluations);
router.post('/unlock-evaluation', authMiddleware(['admin']), facultyController.unlockEvaluation);
router.get('/attendance_records', authMiddleware(['admin', 'faculty', 'ltc_member']), facultyController.getAttendanceRecords);
router.post('/attendance', authMiddleware(['admin', 'faculty', 'ltc_member']), facultyController.markAttendance);
router.post('/students/:studentId/dnr', authMiddleware(['faculty', 'ltc_member', 'admin', 'superadmin']), facultyController.toggleStudentDnr);
router.put('/assign-panel', authMiddleware(['faculty', 'ltc_member']), facultyController.assignPanel);
router.put('/squad-leader', authMiddleware(['faculty', 'ltc_member']), facultyController.updateSquadLeader);
router.put('/squad-designation', authMiddleware(['admin', 'faculty', 'ltc_member']), facultyController.updateSquadDesignation);
router.get('/profile', authMiddleware(['faculty', 'ltc_member']), facultyController.getProfile);
router.post('/request-password-otp', authMiddleware(['faculty', 'ltc_member', 'superadmin', 'superadmin_readonly', 'admin']), passwordOtpController.requestPasswordOtp);
router.post('/resend-password-otp', authMiddleware(['faculty', 'ltc_member', 'superadmin', 'superadmin_readonly', 'admin']), passwordOtpController.resendPasswordOtp);
router.post('/verify-password-otp', authMiddleware(['faculty', 'ltc_member', 'superadmin', 'superadmin_readonly', 'admin']), passwordOtpController.verifyPasswordOtp);
router.put('/change-password', authMiddleware(['faculty', 'ltc_member']), (req, res) => res.status(403).json({ message: 'Direct password change is disabled. Please request an email OTP to verify and update your password.' }));
const multer = require('multer');
const upload = multer({ limits: { fileSize: 500 * 1024 * 1024 } });

router.get('/journey-media', authMiddleware(['faculty', 'ltc_member']), facultyController.getJourneyMedia);
router.post('/journey-media', authMiddleware(['faculty', 'ltc_member']), facultyController.uploadJourneyMedia);
router.post('/journey-media/binary-upload', authMiddleware(['faculty', 'ltc_member']), upload.single('file'), facultyController.uploadJourneyBinaryMedia);
router.post('/journey-media/presigned-url', authMiddleware(['faculty', 'ltc_member']), facultyController.getJourneyPresignedUrl);
router.post('/journey-media/multipart-part-url', authMiddleware(['faculty', 'ltc_member']), facultyController.getJourneyMultipartPartUrl);
router.post('/journey-media/complete-multipart', authMiddleware(['faculty', 'ltc_member']), facultyController.completeJourneyMultipartUpload);
router.post('/journey-media/abort-multipart', authMiddleware(['faculty', 'ltc_member']), facultyController.abortJourneyMultipartUpload);
router.delete('/journey-media/:id', authMiddleware(['faculty', 'ltc_member']), facultyController.deleteJourneyMedia);

// Performance Admin routes for Faculty / LTC Members (Fall In, Yoga, Agriculture)
const superadminController = require('../controllers/superadminController');
router.get('/performance-admin/my-roles', authMiddleware(['faculty', 'ltc_member', 'superadmin']), facultyController.getMyPerformanceRoles);
router.get('/performance-admin/activities', authMiddleware(['faculty', 'ltc_member', 'superadmin']), facultyController.getPerformanceAdminActivities);
router.post('/performance-admin/save-activity', authMiddleware(['faculty', 'ltc_member', 'superadmin']), superadminController.saveSquadPerformanceActivity);
router.post('/performance-admin/reset-activity', authMiddleware(['faculty', 'ltc_member', 'superadmin']), superadminController.resetSquadPerformanceActivity);

module.exports = router;
