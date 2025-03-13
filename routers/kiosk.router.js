const express = require('express');
const kiosk_controller = require('../controllers/kiosk.controller');
const router = express.Router();

/* GET */
router.get('/', kiosk_controller.get_kiosks);
router.get('/:kioskID', kiosk_controller.get_kiosk);

/* POST */
router.post('/', kiosk_controller.add_kiosk);

/* PATCH */

/* DELETE */

module.exports = router;
