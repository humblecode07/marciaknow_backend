const express = require('express');
const room_controller = require('../controllers/room.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */
// router.get('/', room_controller.get_rooms);

/* POST */
router.post('/:buildingID/:kioskID', upload.array('image'), room_controller.add_room);

/* PATCH */


/* DELETE */

module.exports = router;