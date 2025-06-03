const express = require('express');
const router = express.Router();
const {
   getRecentDestinationSearch,
   logDestinationSearch,
   getMostFrequentDestinations,
   getDailySearchActivity,
} = require('../controllers/destinationLog.controller');

// Get most frequent destinations
router.get('/recent-destinations', getRecentDestinationSearch);
router.get('/frequent-destinations', getMostFrequentDestinations);

router.get('/daily-search-activity', getDailySearchActivity);

// Log destination search/selection
router.post('/', logDestinationSearch);



module.exports = router;