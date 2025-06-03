const express = require('express');
const router = express.Router();
const {
   getRecentDestinationSearch,
   logDestinationSearch,
   getMostFrequentDestinations,
   getDailySearchActivity,
} = require('../controllers/destinationLog.controller');
const { authenticateToken, verifyNotDisabled } = require('../middleware/auth')

// Get most frequent destinations
router.get('/recent-destinations', authenticateToken, verifyNotDisabled, getRecentDestinationSearch);
router.get('/frequent-destinations', authenticateToken, verifyNotDisabled, getMostFrequentDestinations);

router.get('/daily-search-activity', authenticateToken, verifyNotDisabled, getDailySearchActivity);

// Log destination search/selection
router.post('/', authenticateToken, verifyNotDisabled, logDestinationSearch);



module.exports = router;