const express = require('express');
const building_controller = require('../controllers/building.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */

/* POST */
router.post('/', building_controller.add_building);

/* PATCH */

/* DELETE */

module.exports = router;