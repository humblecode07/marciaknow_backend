const express = require('express');
const building_controller = require('../controllers/building.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();
const { authenticateToken, verifyNotDisabled } = require('../middleware/auth');

/* GET */
router.get('/', building_controller.get_buildings);
router.get('/:buildingID', building_controller.get_building);
router.get('/get/:kioskID', building_controller.get_buildings_based_from_kiosk);

/* POST */
router.post('/', authenticateToken, verifyNotDisabled, building_controller.add_building);

/* PUT */
router.put('/:buildingId/:kioskID', upload.array('files'), authenticateToken, verifyNotDisabled, building_controller.edit_building);

/* DELETE */

module.exports = router;