const express = require('express');
const room_controller = require('../controllers/room.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */

/* POST */
router.post('/', room_controller.add_room);

/* PATCH */

/* DELETE */

module.exports = router;