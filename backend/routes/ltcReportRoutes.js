const express = require('express');
const router = express.Router();
const ltcReportController = require('../controllers/ltcReportController');
const authMiddleware = require('../middleware/auth');

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Upload report annexure file (PDF or Image)
router.post(
  '/upload-annexure',
  authMiddleware(['superadmin', 'admin', 'support', 'jeeten']),
  upload.single('file'),
  ltcReportController.uploadReportAnnexure
);

// List all batches for report selection
router.get(
  '/batches',
  authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']),
  ltcReportController.getReportBatches
);

// Get report data for a batch (accessible by Support, Superadmin, Admin)
router.get(
  '/batch/:batchId',
  authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']),
  ltcReportController.getBatchReport
);

// Fetch allocated awards from certificates table for a batch
router.get(
  '/batch/:batchId/allocated-awards',
  authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']),
  ltcReportController.getBatchAllocatedAwards
);

// Save report data for a batch (Support can update all pages 1-6, Superadmin can update all)
router.post(
  '/batch/:batchId',
  authMiddleware(['superadmin', 'admin', 'support', 'jeeten']),
  ltcReportController.saveBatchReport
);

router.put(
  '/batch/:batchId',
  authMiddleware(['superadmin', 'admin', 'support', 'jeeten']),
  ltcReportController.saveBatchReport
);

// Save room allotments for students and faculty
router.post(
  '/batch/:batchId/room-allotments',
  authMiddleware(['superadmin', 'admin', 'support', 'jeeten']),
  ltcReportController.saveRoomAllotments
);

// Generate AI Pre, Post & Service Feedback Analysis (100% Positive Review)
router.post(
  '/batch/:batchId/analyze-feedback',
  authMiddleware(['superadmin', 'admin', 'support', 'jeeten']),
  ltcReportController.analyzeBatchFeedbackWithAi
);

// Beacon endpoint: called by navigator.sendBeacon on beforeunload (token passed in body, not header)
router.post(
  '/batch/:batchId/beacon',
  ltcReportController.beaconSaveBatchReport
);

// Generate & download the LTC Template PDF matching LTC_template.docx.pdf
router.get(
  '/batch/:batchId/pdf',
  authMiddleware(['superadmin', 'admin', 'superadmin_readonly', 'dean_ltc', 'support', 'jeeten']),
  ltcReportController.generateLtcTemplatePdf
);

module.exports = router;
