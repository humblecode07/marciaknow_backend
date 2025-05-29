const express = require('express');
const refresh_token_controller = require('../controllers/refreshToken.controller');
const router = express.Router();

/* POST request user create */
router.get('/', refresh_token_controller.handle_refresh_token);

module.exports = router;