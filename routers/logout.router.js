const express = require('express');
const logout_controller = require('../controllers/logout.controller');
const router = express.Router();

/* POST request user create */
router.get('/', logout_controller.handle_logout);

module.exports = router;