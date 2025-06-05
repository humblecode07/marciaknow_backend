const express = require('express');
const kiosk_controller = require('../controllers/kiosk.controller');
const router = express.Router();
const { authenticateToken, verifyNotDisabled } = require('../middleware/auth');

/* GET */
router.get('/', kiosk_controller.get_kiosks);
router.get('/:kioskID', authenticateToken, verifyNotDisabled, kiosk_controller.get_kiosk);

/* POST */
router.post('/', authenticateToken, verifyNotDisabled, kiosk_controller.add_kiosk);
router.post('/ping/:kioskID', kiosk_controller.ping_kiosk);

/* PATCH */
router.patch('/:kioskID', authenticateToken, verifyNotDisabled, kiosk_controller.edit_kiosk);

/* DELETE */
router.delete('/:kioskID', authenticateToken, verifyNotDisabled, kiosk_controller.delete_kiosk);

module.exports = router;
