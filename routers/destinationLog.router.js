const express = require('express');
const router = express.Router();
const {
   logDestinationSearch,
   getMostFrequentDestinations,
} = require('../controllers/destinationLog.controller');

// Log destination search/selection
router.post('/', logDestinationSearch);

// Get most frequent destinations
router.get('/frequent-destinations', getMostFrequentDestinations);

module.exports = router;