const express = require('express');
const room_controller = require('../controllers/room.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();
const { authenticateToken, verifyNotDisabled } = require('../middleware/auth');

/* GET */
router.get('/', room_controller.get_all_rooms); 
router.get('/:kioskID', room_controller.get_rooms_for_kiosk); 
router.get('/:buildingID/:roomID', room_controller.get_room_from_building); 

/* POST */
router.post('/:buildingID/:kioskID', upload.array('images[]'), authenticateToken, verifyNotDisabled, room_controller.add_room);

/* PATCH */
router.patch('/:buildingID/:kioskID/:roomID', upload.array('images[]'), authenticateToken, verifyNotDisabled, room_controller.edit_room);

/* DELETE */
router.delete('/:buildingID/:kioskID/:roomID', authenticateToken, verifyNotDisabled, room_controller.delete_room);

module.exports = router;