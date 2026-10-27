const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const riOrangeFlagController = require('../controllers/riOrangeFlagController');
const riFacultyAuth = require('../middleware/riFacultyAuth');
const authMiddleware = require('../middleware/auth');

// Multer storage for RI Orange Flag Medical Reports / Prescriptions (Optional)
const medUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/ri_medical_reports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    cb(null, `ri_med_${Date.now()}_${cleanBase || 'doc'}${ext}`);
  }
});

const uploadMedicalReport = multer({
  storage: medUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = file.mimetype && file.mimetype.startsWith('image/');
    const isDoc = file.mimetype && (file.mimetype === 'application/pdf' || file.mimetype.includes('word') || file.mimetype.includes('document'));
    if (allowed.includes(ext) || isImage || isDoc) {
      cb(null, true);
    } else {
      cb(new Error('Only medical report / prescription documents (PDF, JPG, PNG, WEBP, DOC, DOCX) up to 10MB are allowed.'));
    }
  }
});

const handleOptionalMedicalUpload = (req, res, next) => {
  uploadMedicalReport.single('medical_report')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Medical report exceeds maximum upload size (max 10MB).' });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// ── Role Definitions ──
const adminRoles = [
  'ri_admin',
  'superadmin-ri',
  'superadmin',
  'superadmin_ri_readonly',
  'superadmin-ri-readonly',
  'admin'
];

const allAuthorizedRoles = [
  ...adminRoles,
  'faculty',
  'ri_faculty'
];

// ── Faculty Scope (Requires riFacultyAuth) ──
router.get('/faculty/students', riFacultyAuth, riOrangeFlagController.getFacultyStudents);
router.post('/faculty/report', riFacultyAuth, handleOptionalMedicalUpload, riOrangeFlagController.reportFacultyOrangeFlag);
router.get('/faculty/my-flags', riFacultyAuth, riOrangeFlagController.getMyFacultyOrangeFlags);
router.post('/faculty/:id/follow-up', riFacultyAuth, riOrangeFlagController.addFollowUpNote);

// ── Shared Detail Retrieval ──
router.get('/:id/details', authMiddleware(allAuthorizedRoles), riOrangeFlagController.getOrangeFlagDetails);

// ── Admin & Super Admin Scope ──
router.get('/admin/all', authMiddleware(adminRoles), riOrangeFlagController.getAllOrangeFlags);
router.patch('/admin/:id/status', authMiddleware(adminRoles), riOrangeFlagController.updateOrangeFlagStatus);
router.post('/admin/:id/follow-up', authMiddleware(adminRoles), riOrangeFlagController.addFollowUpNote);
router.get('/admin/export', authMiddleware(adminRoles), riOrangeFlagController.downloadOrangeFlagsExcel);

module.exports = router;
