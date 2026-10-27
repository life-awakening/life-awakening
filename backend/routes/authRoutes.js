const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/login', authController.login);

// Parent Child Retrieval
router.get('/parent/children', authMiddleware(['parent']), authController.getParentChildren);

// Forgot Password Flow Routes
router.post('/forgot-password/request', authController.requestPasswordReset);
router.post('/forgot-password/verify-otp', authController.verifyResetOtp);
router.post('/forgot-password/reset-password', authController.resetPassword);

module.exports = router;

