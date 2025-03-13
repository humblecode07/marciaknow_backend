const express = require('express');
const kiosk_controller = require('../controllers/kiosk.controller');
const router = express.Router();

/* GET */
router.get('/', kiosk_controller.get_kiosks);
router.get('/:kioskID', kiosk_controller.get_kiosk);

/* POST */
router.post('/', kiosk_controller.add_kiosk);

/* PATCH */
router.patch('/:kioskID', kiosk_controller.edit_kiosk);

/* DELETE */
router.delete('/:kioskID', kiosk_controller.delete_kiosk);

module.exports = router;
