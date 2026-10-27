const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const riFacultyController = require('../controllers/riFacultyController');
const riFacultyAuth = require('../middleware/riFacultyAuth');

// Multer in-memory storage for new RI Faculty uploads (photos, certificates, and videos)
// Existing uploads on EC2 in backend/uploads/ri_media/ are preserved and NEVER written over.
const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB to comfortably support 2-min smartphone videos
  fileFilter: (req, file, cb) => {
    const allowed = [
      '.jpg', '.jpeg', '.png', '.webp',
      '.pdf', '.doc', '.docx',
      '.mp4', '.mov', '.webm', '.m4v', '.3gp', '.avi', '.mkv'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const isVideoMime = file.mimetype && file.mimetype.startsWith('video/');
    if (allowed.includes(ext) || isVideoMime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WEBP), documents (PDF, DOC, DOCX), and video files (MP4, MOV, WEBM, 3GP, MKV) are allowed.'));
    }
  }
});

const handleSingleUpload = (req, res, next) => {
  uploadMulter.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File exceeds maximum upload size (max 200MB).' });
      }
      return res.status(400).json({ message: err.message });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
};

// Download Gram Panchayat Certificate Word Templates (English & Marathi)
router.get('/templates/certificate/:lang', riFacultyController.downloadCertificateTemplate);

// Secure File Proxy & Viewer for Faculty Uploads (handles both legacy EC2 local files and new S3 objects)
router.get('/files/view', riFacultyController.serveFacultyFile);

// All RI Faculty Portal endpoints require authentication and panel assignment verification
router.use(riFacultyAuth);

// Single-use object-bound file access ticket generator (Authorized for Faculty and Admins)
router.post('/files/ticket', riFacultyController.createFacultyFileAccessTicket);

const pool = require('../config/db');

/**
 * RI Faculty Undertaking Enforcement Middleware
 * Blocks access to all panel operations, attendance sheets, evaluations, student rosters,
 * and media uploads until the faculty member has digitally signed and submitted their RI undertaking.
 */
const requireFacultyUndertaking = async (req, res, next) => {
  try {
    // Superadmin / Admin preview bypass
    if (req.isRiAdminPreview) {
      return next();
    }

    const facultyUserId = req.user?.id;
    const userEmail = req.userEmail;

    // Check users table first
    const userRes = await pool.query(
      `SELECT ri_undertaking_submitted FROM users WHERE id = $1 OR LOWER(email) = $2 LIMIT 1`,
      [facultyUserId || -1, userEmail]
    );

    let isSubmitted = Boolean(userRes.rows[0]?.ri_undertaking_submitted);

    if (!isSubmitted) {
      const underRes = await pool.query(
        `SELECT id FROM ri_faculty_undertakings 
         WHERE faculty_id = $1 OR faculty_id IN (SELECT id FROM users WHERE LOWER(email) = $2)
         LIMIT 1`,
        [facultyUserId || -1, userEmail]
      );
      if (underRes.rowCount > 0) {
        isSubmitted = true;
      }
    }

    if (!isSubmitted) {
      return res.status(403).json({
        message: 'Please complete your RI Faculty Undertaking first to access the RI Faculty Portal.',
        requires_undertaking: true,
        gate_type: 'RI_FACULTY_UNDERTAKING_REQUIRED'
      });
    }

    next();
  } catch (err) {
    console.error('Error verifying faculty undertaking status:', err);
    return res.status(500).json({ message: 'Error verifying faculty undertaking status', error: err.message });
  }
};

// 1. Profile & Assigned Panels (Unrestricted - needed for profile & gate verification)
router.get('/profile', riFacultyController.getFacultyProfile);

// 2. Dashboard overview for an assigned panel (Restricted)
router.get('/dashboard', requireFacultyUndertaking, riFacultyController.getFacultyDashboard);

// 3. My Panel detailed view (Village info, Sarpanch, co-mentors, students) (Restricted)
router.get('/panel', requireFacultyUndertaking, riFacultyController.getMyPanel);

// 4. Panel Students list (Searchable & paginated) (Restricted)
router.get('/students', requireFacultyUndertaking, riFacultyController.getPanelStudents);

// 5. Activities & Evaluation Rubric (Restricted)
router.get('/activities', requireFacultyUndertaking, riFacultyController.getActivitiesAndEvaluation);

// 6. Schedule Timeline (Restricted)
router.get('/schedule', requireFacultyUndertaking, riFacultyController.getImmersionSchedule);

// 7. Panel Attendance Sheet & Mark Attendance (Restricted)
router.get('/attendance', requireFacultyUndertaking, riFacultyController.getPanelAttendance);
router.post('/attendance', requireFacultyUndertaking, riFacultyController.markPanelAttendance);
router.post('/attendance/mark-all-present', requireFacultyUndertaking, riFacultyController.markAllActivitiesPresent);
router.get('/attendance/excel', requireFacultyUndertaking, riFacultyController.downloadAttendanceExcel);

// 8. Student Submissions & Forms Overview (Restricted)
router.get('/submissions', requireFacultyUndertaking, riFacultyController.getPanelSubmissions);

// 9. Detailed Student RI Workspace & Profile (10 Tabs) (Restricted)
router.get('/students/:studentId/workspace', requireFacultyUndertaking, riFacultyController.getStudentSubmissionDetail);

// 10. Save / Submit Faculty Evaluation (Restricted)
router.get('/evaluations', requireFacultyUndertaking, riFacultyController.getPanelEvaluations);
router.post('/evaluations', requireFacultyUndertaking, riFacultyController.saveStudentEvaluation);
router.post('/evaluations/bulk', requireFacultyUndertaking, riFacultyController.saveBulkEvaluations);

// 11. Multi-Sheet Excel Exports for Panel Modules (Restricted)
router.get('/exports/attendance', requireFacultyUndertaking, riFacultyController.downloadAttendanceExcel);
router.get('/exports/attendance/excel', requireFacultyUndertaking, riFacultyController.downloadAttendanceExcel);
router.get('/exports/forms', requireFacultyUndertaking, riFacultyController.downloadStudentFormsExcel);
router.get('/exports/forms/excel', requireFacultyUndertaking, riFacultyController.downloadStudentFormsExcel);
router.get('/exports/evaluation', requireFacultyUndertaking, riFacultyController.downloadEvaluationExcel);
router.get('/exports/evaluation/excel', requireFacultyUndertaking, riFacultyController.downloadEvaluationExcel);
router.get('/exports/family-survey', requireFacultyUndertaking, riFacultyController.downloadFamilySurveysExcel);
router.get('/exports/family-survey/excel', requireFacultyUndertaking, riFacultyController.downloadFamilySurveysExcel);
router.get('/exports/community-projects', requireFacultyUndertaking, riFacultyController.downloadCommunityProjectsExcel);
router.get('/exports/community-projects/excel', requireFacultyUndertaking, riFacultyController.downloadCommunityProjectsExcel);
router.get('/exports/institutional-visits', requireFacultyUndertaking, riFacultyController.downloadInstitutionalVisitsExcel);
router.get('/exports/institutional-visits/excel', requireFacultyUndertaking, riFacultyController.downloadInstitutionalVisitsExcel);
router.get('/exports/overall-assessment', requireFacultyUndertaking, riFacultyController.downloadOverallAssessmentExcel);
router.get('/exports/overall-assessment/excel', requireFacultyUndertaking, riFacultyController.downloadOverallAssessmentExcel);

// 12. RI Faculty Undertaking (Unrestricted - needed for status check and submission)
router.get('/undertaking', riFacultyController.getFacultyUndertaking);
router.post('/undertaking', riFacultyController.submitFacultyUndertaking);

// 13. Faculty Allocated Village & Emergency Services (Restricted)
router.get('/village-services', requireFacultyUndertaking, riFacultyController.getFacultyVillageDetails);

// 14. Faculty Panel Uploads (Restricted: Max 5 Photos + Gram Panchayat Certificate + Stakeholder Feedback Video)
router.get('/uploads', requireFacultyUndertaking, riFacultyController.getPanelMedia);
router.get('/media', requireFacultyUndertaking, riFacultyController.getPanelMedia); // backward compat
router.post('/uploads/photo', requireFacultyUndertaking, handleSingleUpload, riFacultyController.uploadPanelPhoto);
router.post('/uploads/certificate', requireFacultyUndertaking, handleSingleUpload, riFacultyController.uploadGramPanchayatCertificate);
router.post('/uploads/feedback-video', requireFacultyUndertaking, handleSingleUpload, riFacultyController.uploadStakeholderFeedbackVideo);
router.post('/uploads/stakeholder-feedback', requireFacultyUndertaking, handleSingleUpload, riFacultyController.uploadStakeholderFeedbackVideo);
router.post('/uploads', requireFacultyUndertaking, handleSingleUpload, riFacultyController.uploadPanelMedia);
router.post('/media', requireFacultyUndertaking, handleSingleUpload, riFacultyController.uploadPanelPhoto); // backward compat
router.delete('/uploads/:id', requireFacultyUndertaking, riFacultyController.deletePanelMedia);
router.delete('/media/:id', requireFacultyUndertaking, riFacultyController.deletePanelMedia); // backward compat

// 15. RI Faculty Settings & Password Reset via Secure OTP
const riFacultySettingsController = require('../controllers/riFacultySettingsController');
router.post('/settings/request-password-otp', riFacultySettingsController.requestPasswordOtp);
router.post('/settings/resend-password-otp', riFacultySettingsController.resendPasswordOtp);
router.post('/settings/verify-password-otp', riFacultySettingsController.verifyPasswordOtp);
router.post('/settings/reset-password', riFacultySettingsController.resetPassword);

// Direct route aliases for backward & unified client compatibility
router.post('/request-password-otp', riFacultySettingsController.requestPasswordOtp);
router.post('/resend-password-otp', riFacultySettingsController.resendPasswordOtp);
router.post('/verify-password-otp', riFacultySettingsController.verifyPasswordOtp);
router.post('/reset-password', riFacultySettingsController.resetPassword);

module.exports = router;


