// routes/scanRoutes.js
const express = require('express');
const router = express.Router();
const {
   logQrScan,
   getDailyScanReport,
   getTotalScanCount,
   getRecentScanLogs,
   getBuildingKioskStats
} = require('../controllers/qrReports.controller');
const { authenticateToken, verifyNotDisabled } = require('../middleware/auth');

// Middleware for parameter validation
const validateScanParams = (req, res, next) => {
   const { buildingId, kioskId } = req.params;

   if (!buildingId || !kioskId) {
      return res.status(400).json({
         success: false,
         message: 'Building ID and Kiosk ID are required'
      });
   }

   if (!/^[0-9a-fA-F]{24}$/.test(buildingId)) {
      return res.status(400).json({
         success: false,
         message: 'Invalid building ID format'
      });
   }

   next();
};

const validateDateRange = (req, res, next) => {
   const { startDate, endDate } = req.query;

   if (startDate && isNaN(Date.parse(startDate))) {
      return res.status(400).json({
         success: false,
         message: 'Invalid start date format. Use YYYY-MM-DD'
      });
   }

   if (endDate && isNaN(Date.parse(endDate))) {
      return res.status(400).json({
         success: false,
         message: 'Invalid end date format. Use YYYY-MM-DD'
      });
   }

   if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
         success: false,
         message: 'Start date cannot be after end date'
      });
   }

   next();
};

// Routes

// POST /api/scan/:buildingId/:kioskId - Log QR scan when user lands on ScanGuide
router.post('/:buildingId/:kioskId', validateScanParams, authenticateToken, verifyNotDisabled, logQrScan);

// GET /api/scan/reports/daily - Get daily scan report
// Query params: startDate, endDate, kioskId, buildingId
router.get('/reports/daily', validateDateRange, authenticateToken, verifyNotDisabled, getDailyScanReport);

// GET /api/scan/reports/total - Get total scan count
// Query params: kioskId, buildingId
router.get('/reports/total', authenticateToken, verifyNotDisabled, getTotalScanCount);

// GET /api/scan/logs/recent - Get recent scan logs
// Query params: page, limit, kioskId, buildingId
router.get('/logs/recent', authenticateToken, verifyNotDisabled, getRecentScanLogs);

// GET /api/scan/stats/buildings - Get statistics by building and kiosk
router.get('/stats/buildings', authenticateToken, verifyNotDisabled, getBuildingKioskStats);

// Health check endpoint
router.get('/health', authenticateToken, verifyNotDisabled, (req, res) => {
   res.status(200).json({
      success: true,
      message: 'Scan logging service is running',
      timestamp: new Date().toISOString()
   });
});

module.exports = router;