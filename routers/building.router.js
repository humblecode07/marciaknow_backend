const express = require('express');
const building_controller = require('../controllers/building.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */
router.get('/', building_controller.get_buildings);

/* POST */
router.post('/', building_controller.add_building);

/* PATCH */
router.post('/:buildingId', building_controller.edit_building);

/* DELETE */

module.exports = router;