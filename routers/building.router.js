const express = require('express');
const building_controller = require('../controllers/building.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */
router.get('/', building_controller.get_buildings);
router.get('/:buildingID', building_controller.get_building);
router.get('/get/:kioskID', building_controller.get_buildings_based_from_kiosk);

/* POST */
router.post('/', building_controller.add_building);

/* PATCH */
router.patch('/:buildingId/:kioskID', upload.array('images[]'), building_controller.edit_building);

/* DELETE */

module.exports = router;