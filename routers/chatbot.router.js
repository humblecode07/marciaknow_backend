// routes/chatbot.routes.js
const express = require('express');
const router = express.Router();
const {
   getMetrics,
   getInteractionLogs,
   logInteraction,
   getSessionHistory,
   getPopularQueries,
   getKioskPerformance,
   cleanupOldLogs
} = require('../controllers/chatbot.controller');

// Optional: Add authentication middleware if needed
// const { authenticate, authorize } = require('../middleware/auth');

// GET /api/chatbot/metrics - Get chatbot metrics for reports
router.get('/metrics', getMetrics);

// GET /api/chatbot/interactions - Get detailed interaction logs with filtering and pagination
router.get('/interactions', getInteractionLogs);

// POST /api/chatbot/interactions - Log a new chatbot interaction
router.post('/interactions', logInteraction);

// GET /api/chatbot/sessions/:sessionId - Get session history for a specific session
router.get('/sessions/:sessionId', getSessionHistory);

// GET /api/chatbot/popular-queries - Get popular queries/topics
router.get('/popular-queries', getPopularQueries);

// GET /api/chatbot/kiosk-performance - Get kiosk performance comparison
router.get('/kiosk-performance', getKioskPerformance);

// DELETE /api/chatbot/cleanup - Delete old interaction logs (for cleanup/maintenance)
// Note: This is a destructive operation, consider adding admin-only middleware
router.delete('/cleanup', cleanupOldLogs);

module.exports = router;