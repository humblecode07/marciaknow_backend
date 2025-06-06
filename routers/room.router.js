const express = require('express');
const room_controller = require('../controllers/room.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();
const { authenticateToken, verifyNotDisabled } = require('../middleware/auth');

// GET
router.get('/', room_controller.get_all_rooms);
router.get('/kiosk/:kioskID', room_controller.get_rooms_for_kiosk);
router.get('/:buildingID/room/:roomID', room_controller.get_room_from_building);

// POST
router.post('/:buildingID/kiosk/:kioskID', upload.array('images[]'), authenticateToken, verifyNotDisabled, room_controller.add_room);
router.post('/:buildingID/delete', authenticateToken, verifyNotDisabled, room_controller.delete_room_from_all_kiosks);

// PATCH
router.patch('/:buildingID/kiosk/:kioskID/room/:roomID', upload.array('images[]'), authenticateToken, verifyNotDisabled, room_controller.edit_room);

module.exports = router;