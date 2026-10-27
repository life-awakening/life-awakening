const express = require('express');
const router = express.Router();
const riNodalOfficerController = require('../controllers/riNodalOfficerController');
const authMiddleware = require('../middleware/auth');

// Protect all Nodal Officer endpoints: allowed for nodal officers, admins, and faculty members with nodal assignments
router.use(authMiddleware(['ri_nodal_officer', 'nodal_officer', 'ri_admin', 'superadmin-ri', 'superadmin', 'faculty', 'ri_faculty']));

// 1. My Assigned Panels list
router.get('/panels', riNodalOfficerController.getMyAssignedPanels);

// 2. Specific Panel Details
router.get('/panels/:panelId/details', riNodalOfficerController.getPanelDetails);

// 3. Panel Students (Live attendance & undertaking status)
router.get('/panels/:panelId/students', riNodalOfficerController.getPanelStudents);

// 4. Panel Absent Students (Filtered strictly to absentees)
router.get('/panels/:panelId/absent-students', riNodalOfficerController.getAbsentStudents);

// 5. Export Absent Students
router.get('/panels/:panelId/export-absent', riNodalOfficerController.exportAbsentStudentsExcel);

// 6. Change Password
router.post('/change-password', riNodalOfficerController.changeNodalOfficerPassword);

module.exports = router;
