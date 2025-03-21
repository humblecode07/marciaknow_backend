const express = require('express');
const navigationIcon_controller = require('../controllers/navigationIcon.controller');
const router = express.Router();

/* GET */
router.get('/', navigationIcon_controller.get_icons);

/* POST */
router.post('/', navigationIcon_controller.add_icon);

/* PATCH */


/* DELETE */

module.exports = router;