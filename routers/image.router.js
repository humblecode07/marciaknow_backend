const express = require('express');
const image_controller = require('../controllers/image.controller');
const upload = require('../middleware/imageUpload');
const router = express.Router();

/* GET */
router.get('/:filename', image_controller.get_image);

/* POST */
router.post('/:type/:id', upload.array('image'), image_controller.add_image);

/* PATCH */


/* DELETE */

module.exports = router;