const express = require('express');
const building_controller = require('../controllers/building.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();
const { authenticateToken, verifyNotDisabled } = require('../middleware/auth');

/* GET */
router.get('/', authenticateToken, verifyNotDisabled, building_controller.get_buildings);
router.get('/:buildingID', authenticateToken, verifyNotDisabled, building_controller.get_building);
router.get('/get/:kioskID', authenticateToken, verifyNotDisabled, building_controller.get_buildings_based_from_kiosk);

/* POST */
router.post('/', authenticateToken, verifyNotDisabled, building_controller.add_building);

/* PATCH */
router.patch('/:buildingId/:kioskID', upload.array('images[]'), authenticateToken, verifyNotDisabled, building_controller.edit_building);

/* DELETE */

module.exports = router;