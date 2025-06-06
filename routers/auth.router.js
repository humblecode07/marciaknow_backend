const express = require('express');
const admin_controller = require('../controllers/auth.controller');
const router = express.Router();

/* POST request user create */
router.post('/', admin_controller.log_in);



module.exports = router;