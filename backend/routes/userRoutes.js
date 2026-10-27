const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

router.post('/student', authMiddleware(['admin', 'faculty']), adminController.createStudent);

module.exports = router;
