const express = require('express');
const router = express.Router();
const ltcController = require('../controllers/ltcController');
const authMiddleware = require('../middleware/auth');

router.get('/dashboard', authMiddleware(['ltc_member']), ltcController.getDashboard);
router.put('/squad-leader', authMiddleware(['ltc_member']), ltcController.updateSquadLeader);

module.exports = router;
