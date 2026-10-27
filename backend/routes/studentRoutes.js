const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const ltcSummaryController = require('../controllers/ltcSummaryController');
const authMiddleware = require('../middleware/auth');
const authorizeStudentContext = require('../middleware/studentContext');

const pool = require('../config/db');
const passwordOtpController = require('../controllers/passwordOtpController');

const requireLtcUndertaking = async (req, res, next) => {
  try {
    const targetId = req.studentId || req.user.id;
    const userRes = await pool.query('SELECT undertaking_submitted FROM users WHERE id = $1', [targetId]);
    if (!userRes.rows[0]?.undertaking_submitted) {
      return res.status(403).json({
        message: 'Please complete your undertaking first to access the Student Portal.',
        requires_undertaking: true
      });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Error checking undertaking status', error: err.message });
  }
};

router.get('/dashboard', authMiddleware(['student', 'parent']), authorizeStudentContext, studentController.getDashboard);
router.get('/schedules', authMiddleware(['student', 'parent']), authorizeStudentContext, requireLtcUndertaking, studentController.getSchedules);
router.get('/attendance', authMiddleware(['student', 'parent']), authorizeStudentContext, requireLtcUndertaking, studentController.getAttendance);
router.get('/evaluations', authMiddleware(['student', 'parent']), authorizeStudentContext, requireLtcUndertaking, studentController.getEvaluations);
router.post('/submit-insurance', authMiddleware(['student', 'parent']), authorizeStudentContext, studentController.submitInsurance);
router.post('/submit-undertaking', authMiddleware(['student', 'parent']), authorizeStudentContext, studentController.submitUndertaking);
router.get('/profile', authMiddleware(['student', 'parent']), authorizeStudentContext, studentController.getProfile);
router.post('/request-password-otp', authMiddleware(['student', 'parent']), passwordOtpController.requestPasswordOtp);
router.post('/resend-password-otp', authMiddleware(['student', 'parent']), passwordOtpController.resendPasswordOtp);
router.post('/verify-password-otp', authMiddleware(['student', 'parent']), passwordOtpController.verifyPasswordOtp);
router.put('/change-password', authMiddleware(['student', 'parent']), (req, res) => res.status(403).json({ message: 'Direct password change is disabled. Please request an email OTP to verify and update your password.' }));
router.get('/certificate-data', authMiddleware(['student', 'parent']), authorizeStudentContext, requireLtcUndertaking, studentController.getCertificateData);
router.get('/ltc-summary/:studentId', authMiddleware(['student', 'parent', 'faculty', 'ltc_member', 'admin', 'superadmin']), authorizeStudentContext, ltcSummaryController.getLtcSummary);
router.get('/undertaking/pdf/:studentId', authMiddleware(['student', 'parent', 'faculty', 'ltc_member', 'admin', 'superadmin']), authorizeStudentContext, ltcSummaryController.getUndertakingPdf);
router.get('/feedback/pdf/:studentId/:category', authMiddleware(['student', 'parent', 'faculty', 'ltc_member', 'admin', 'superadmin']), authorizeStudentContext, ltcSummaryController.getFeedbackPdf);
router.get('/journey-media', authMiddleware(['student', 'parent']), authorizeStudentContext, requireLtcUndertaking, studentController.getJourneyMedia);
router.get('/available-rooms', authMiddleware(['student', 'parent']), authorizeStudentContext, requireLtcUndertaking, studentController.getAvailableRooms);
router.put('/room', authMiddleware(['student', 'parent']), authorizeStudentContext, requireLtcUndertaking, studentController.updateMyRoom);

module.exports = router;
