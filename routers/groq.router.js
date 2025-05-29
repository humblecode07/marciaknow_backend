const express = require('express');
const groq_controller = require('../controllers/groq.controller');
const router = express.Router();

router.post('/ask/:kioskID', groq_controller.ask)

module.exports = router;