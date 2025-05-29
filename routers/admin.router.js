const express = require('express');
const admin_controller = require('../controllers/admin.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */
router.get('/:filename', admin_controller.getProfileImage);

/* POST request user create */
router.post('/register',  upload.single('image'), admin_controller.register);

module.exports = router;