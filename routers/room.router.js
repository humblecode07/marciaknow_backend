const express = require('express');
const room_controller = require('../controllers/room.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */
router.get('/', room_controller.get_all_rooms); 
router.get('/:buildingID/:roomID', room_controller.get_room_from_building); 

/* POST */
router.post('/:buildingID/:kioskID', upload.array('images[]'), room_controller.add_room);

/* PATCH */
router.patch('/:buildingID/:kioskID/:roomID', upload.array('images[]'), room_controller.edit_room);

/* DELETE */

module.exports = router;