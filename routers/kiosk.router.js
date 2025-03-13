const express = require('express');
const kiosk_controller = require('../controllers/kiosk.controller');
const router = express.Router();

/* GET */
router.get('/', kiosk_controller.get_kiosks);

/* POST */
router.post('/', kiosk_controller.add_kiosk);

/* PATCH */

/* DELETE */

module.exports = router;
