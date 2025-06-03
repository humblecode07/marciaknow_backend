const express = require('express');
const admin_controller = require('../controllers/admin.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();
const { authenticateToken, verifyNotDisabled } = require('../middleware/auth')

/* GET */
router.get('/', authenticateToken, verifyNotDisabled, admin_controller.getAdmins);
router.get('/:adminID', authenticateToken, verifyNotDisabled, admin_controller.getAdmin);
router.get('/profile/:filename', admin_controller.getProfileImage);

/* POST request user create */
router.post('/register', upload.single('image'), authenticateToken, verifyNotDisabled, admin_controller.register);

/* PATCH request user create */
router.patch('/:adminId/field', authenticateToken, verifyNotDisabled, admin_controller.updateAdminField);
router.patch('/:adminId/password', authenticateToken, verifyNotDisabled, admin_controller.updateAdminPassword);
router.patch('/:adminId/disable', authenticateToken, verifyNotDisabled, admin_controller.disableAdmin);
router.patch('/:adminId/enable', authenticateToken, verifyNotDisabled, admin_controller.enableAdmin);

/* PUT request user create */
router.put('/:id/status', authenticateToken, verifyNotDisabled, admin_controller.updateAdminStatus);
router.put('/:adminId', upload.single('image'), authenticateToken, verifyNotDisabled, admin_controller.updateAdmin);
router.put('/:adminId/reset-password', admin_controller.resetPassword);

/* DELETE request */
router.delete('/:adminId/delete-admin', admin_controller.adminDelete);

module.exports = router;