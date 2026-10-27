const express = require('express');
const router = express.Router();
const riStudentController = require('../controllers/riStudentController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer storage for RI student file uploads
const riUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/ri_student_files');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    cb(null, `ri_${Date.now()}_${cleanBase || Math.random().toString(36).slice(2)}${ext}`);
  }
});

const riStudentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB maximum payload
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only images (JPG/PNG/WEBP) and documents (PDF/DOC/DOCX) are allowed'));
  }
});

// Wrap multer so validation errors (type / size) return 400 with a clear message instead of a 500
const singleUpload = (field) => (req, res, next) => {
  riStudentUpload.single(field)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the maximum allowed size.' : err.message;
      return res.status(400).json({ message: msg });
    }
    next();
  });
};

const pool = require('../config/db');

// 0. Secure File Proxy & Viewer (Authorized via Header or single-use ticket; session tokens in query params strictly blocked)
router.get('/files/view', riStudentController.serveStudentFile);

// 0b. Single-use, object-bound file access ticket generator (Authorized for Students, Faculty, and Admins via Bearer token)
router.post(
  '/files/ticket',
  authMiddleware([
    'student',
    'ri_student',
    'ri_faculty',
    'faculty',
    'admin',
    'ri_admin',
    'superadmin',
    'superadmin-ri',
    'superadmin_readonly',
    'superadmin_ri_readonly',
    'superadmin-ri-readonly'
  ]),
  riStudentController.createFileAccessTicket
);

// All other RI Student endpoints require valid student (or superadmin/admin) auth
router.use(authMiddleware(['student', 'superadmin', 'admin']));

const requireRiOrLtcUndertaking = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const ltcCheck = await pool.query(
      `SELECT 1 FROM batch_students bs
       JOIN batches b ON bs.batch_id = b.id
       WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
       LIMIT 1`,
      [studentId]
    );
    const hasLtc = ltcCheck.rowCount > 0;

    if (hasLtc) {
      const userRes = await pool.query('SELECT undertaking_submitted FROM users WHERE id = $1', [studentId]);
      if (!userRes.rows[0]?.undertaking_submitted) {
        return res.status(403).json({
          message: 'Please complete your undertaking first to access both the RI and LTC Student Portals.',
          requires_undertaking: true,
          gate_type: 'LTC_UNDERTAKING_REQUIRED'
        });
      }
    } else {
      const underRes = await pool.query(
        `SELECT id FROM ri_undertakings WHERE student_id = $1 AND (status = 'Submitted' OR signed_name IS NOT NULL) LIMIT 1`,
        [studentId]
      );
      if (underRes.rowCount === 0) {
        return res.status(403).json({
          message: 'Please complete your undertaking first to access the RI Student Portal.',
          requires_undertaking: true,
          gate_type: 'RI_UNDERTAKING_REQUIRED'
        });
      }
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Error verifying undertaking status', error: err.message });
  }
};

// 1. Program eligibility check
router.get('/programs', riStudentController.getStudentPrograms);

// 2. Student RI Profile, Assigned Panel, Mentors & Teammates
router.get('/profile', riStudentController.getStudentProfile);

// 2b. Student Allocated Village & Cached Emergency Services
router.get('/village-services', requireRiOrLtcUndertaking, riStudentController.getStudentVillageDetails);

// 2c. Student Assigned Panel Visit Media Gallery
router.get('/panel-media', requireRiOrLtcUndertaking, riStudentController.getStudentPanelMedia);

// 3. Student 5-Day Attendance Records
router.get('/attendance', requireRiOrLtcUndertaking, riStudentController.getStudentAttendance);

// 4. Student Immersion Schedule & Evaluation Rubrics
router.get('/activities', requireRiOrLtcUndertaking, riStudentController.getStudentActivities);

// 5. Student RI Undertaking Form & Status
router.get('/undertaking', riStudentController.getStudentUndertaking);
router.post('/undertaking', riStudentController.submitStudentUndertaking);

// 6. RI Forms Hub (All 7 official forms status & summary)
router.get('/forms', riStudentController.getStudentFormsHub);

// 7. Form IB: Preparatory Phase Checklist
router.get('/forms/preparatory-checklist', riStudentController.getPreparatoryChecklist);
router.post('/forms/preparatory-checklist', riStudentController.savePreparatoryChecklist);

// 7b. Form IIIB: Daily Activity Report - Students (ANNEX G-5)
router.get('/forms/daily-activity-report', riStudentController.getDailyActivityReport);
router.post('/forms/daily-activity-report', riStudentController.saveDailyActivityReport);
router.post('/forms/daily-activity-report/upload-photo', singleUpload('photo'), riStudentController.uploadDailyActivityPhoto);

// 8. Form IV: Institutional Visit Observations
router.get('/forms/institutional-visits', riStudentController.getInstitutionalVisits);
router.post('/forms/institutional-visits', riStudentController.saveInstitutionalVisits);
router.post('/forms/institutional-visits/upload-photo', singleUpload('photo'), riStudentController.uploadInstitutionalPhoto);

// 9. Form V: Multi-Household Family Visit
router.get('/forms/family-surveys', riStudentController.getFamilySurveys);
router.post('/forms/family-surveys', riStudentController.saveFamilyRecord);
router.put('/forms/family-surveys/:serial', riStudentController.saveFamilyRecord);
router.delete('/forms/family-surveys/:serial', riStudentController.deleteFamilyRecord);
router.post('/forms/family-surveys/record', riStudentController.saveFamilyRecord);
router.delete('/forms/family-surveys/record/:serial', riStudentController.deleteFamilyRecord);
router.post('/forms/family-surveys/submit', riStudentController.submitFamilySurveys);
router.post('/forms/family-surveys/submit-all', riStudentController.submitFamilySurveys);

// 10. Form VI: Problem Statement & Solution
router.get('/forms/problem-identification', riStudentController.getProblemIdentification);
router.post('/forms/problem-identification', riStudentController.saveProblemIdentification);
// Form VI: Upload 1500-word assignment document (PDF/DOC/DOCX)
router.post('/forms/problem-identification/upload-document', singleUpload('document'), riStudentController.uploadAssignmentDocument);

// 11. Community Project & Activity Details
router.get('/forms/community-project', riStudentController.getCommunityProject);
router.post('/forms/community-project', riStudentController.saveCommunityProject);
// Form VII: Upload activity photo (1 per student)
router.post('/forms/community-project/upload-photo', singleUpload('photo'), riStudentController.uploadCommunityPhoto);

// 12. Student RI Feedback & Self-Reflection
router.get('/forms/feedback', riStudentController.getStudentFeedback);
router.post('/forms/feedback', riStudentController.saveStudentFeedback);

// 13. Student Evaluation Result (When Published)
router.get('/evaluation', requireRiOrLtcUndertaking, riStudentController.getStudentEvaluationResult);

// 14. Things to Carry (Packing Readiness Checklist - Student-Isolated)
router.get('/packing-checklist', riStudentController.getPackingChecklist);
router.put('/packing-checklist', riStudentController.savePackingChecklist);
router.post('/packing-checklist', riStudentController.savePackingChecklist);

module.exports = router;


