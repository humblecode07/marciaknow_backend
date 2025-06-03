const express = require('express');
const admin_controller = require('../controllers/admin.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */
router.get('/', admin_controller.getAdmins);
router.get('/:adminID', admin_controller.getAdmin);
router.get('/profile/:filename', admin_controller.getProfileImage);

/* POST request user create */
router.post('/register',  upload.single('image'), admin_controller.register);

/* PATCH request user create */
router.patch('/:adminId/field', admin_controller.updateAdminField);
router.patch('/:adminId/password', admin_controller.updateAdminPassword);
router.patch('/:adminId/disable', admin_controller.disableAdmin);
router.patch('/:adminId/enable', admin_controller.enableAdmin);

/* PUT request user create */
router.put('/:id/status', admin_controller.updateAdminStatus);
router.put('/:adminId', upload.single('image'), admin_controller.updateAdmin);

module.exports = router;