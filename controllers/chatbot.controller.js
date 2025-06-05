// controllers/chatbot.controller.js
const asyncHandler = require('express-async-handler');
const { getChatbotMetrics, logChatbotInteraction } = require('../services/chatbot.service');
const ChatbotInteraction = require('../models/chatbot.model');

exports.getMetrics = asyncHandler(async (req, res) => {
   try {
      const { timeframe = 'month', kioskID } = req.query;

      const metrics = await getChatbotMetrics(timeframe, kioskID);

      res.json({
         success: true,
         data: metrics
      });
   } catch (error) {
      console.error('Error fetching chatbot metrics:', error);
      res.status(500).json({
         success: false,
         error: 'Failed to fetch chatbot metrics',
         message: error.message
      });
   }
});

// Get detailed interaction logs
exports.getInteractionLogs = asyncHandler(async (req, res) => {
   try {
      const {
         timeframe = 'month',
         kioskID,
         page = 1,
         limit = 50,
         action, // filter by action type
         sessionId // filter by session
      } = req.query;

      const now = new Date();
      let startDate;

      switch (timeframe) {
         case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
         case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
         case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
         default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const matchQuery = {
         timestamp: { $gte: startDate }
      };

      if (kioskID) {
         matchQuery.kioskID = kioskID;
      }

      if (action && action !== 'all') {
         matchQuery['detectedLocation.action'] = action;
      }

      if (sessionId) {
         matchQuery.sessionId = sessionId;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [interactions, totalCount] = await Promise.all([
         ChatbotInteraction.find(matchQuery)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
         ChatbotInteraction.countDocuments(matchQuery)
      ]);

      const totalPages = Math.ceil(totalCount / parseInt(limit));

      res.json({
         success: true,
         data: {
            interactions,
            pagination: {
               currentPage: parseInt(page),
               totalPages,
               totalCount,
               hasNext: parseInt(page) < totalPages,
               hasPrev: parseInt(page) > 1
            },
            filters: {
               timeframe,
               kioskID,
               action,
               sessionId,
               dateRange: {
                  start: startDate,
                  end: now
               }
            }
         }
      });
   } catch (error) {
      console.error('Error fetching interaction logs:', error);
      res.status(500).json({
         success: false,
         error: 'Failed to fetch interaction logs',
         message: error.message
      });
   }
});

// Log a new chatbot interaction
exports.logInteraction = asyncHandler(async (req, res) => {
   try {
      const {
         kioskID,
         userMessage,
         aiResponse,
         detectedLocation,
         responseTime,
         sessionId
      } = req.body;

      // Validate required fields
      if (!kioskID || !userMessage || !aiResponse) {
         return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            message: 'kioskID, userMessage, and aiResponse are required'
         });
      }

      const interactionData = {
         kioskID,
         userMessage,
         aiResponse,
         detectedLocation: detectedLocation || {},
         responseTime: responseTime || 0,
         sessionId: sessionId || null
      };

      console.log('interactionData', interactionData);

      const interaction = await logChatbotInteraction(interactionData);

      res.status(201).json({
         success: true,
         data: interaction,
         message: 'Interaction logged successfully'
      });
   } catch (error) {
      console.error('Error logging interaction:', error);
      res.status(500).json({
         success: false,
         error: 'Failed to log interaction',
         message: error.message
      });
   }
});

// Get session history for a specific session
exports.getSessionHistory = asyncHandler(async (req, res) => {
   try {
      const { sessionId } = req.params;
      const { limit = 100 } = req.query;

      if (!sessionId) {
         return res.status(400).json({
            success: false,
            error: 'Session ID is required'
         });
      }

      const interactions = await ChatbotInteraction.find({ sessionId })
         .sort({ timestamp: 1 })
         .limit(parseInt(limit))
         .lean();

      const sessionStats = {
         totalInteractions: interactions.length,
         startTime: interactions[0]?.timestamp,
         endTime: interactions[interactions.length - 1]?.timestamp,
         avgResponseTime: interactions.reduce((sum, int) => sum + int.responseTime, 0) / interactions.length || 0,
         kioskID: interactions[0]?.kioskID
      };

      res.json({
         success: true,
         data: {
            sessionId,
            interactions,
            stats: sessionStats
         }
      });
   } catch (error) {
      console.error('Error fetching session history:', error);
      res.status(500).json({
         success: false,
         error: 'Failed to fetch session history',
         message: error.message
      });
   }
});

// Get popular queries/topics
exports.getPopularQueries = asyncHandler(async (req, res) => {
   try {
      const {
         timeframe = 'month',
         kioskID,
         limit = 20
      } = req.query;

      const now = new Date();
      let startDate;

      switch (timeframe) {
         case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
         case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
         case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
         default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const matchQuery = {
         timestamp: { $gte: startDate }
      };

      if (kioskID) {
         matchQuery.kioskID = kioskID;
      }

      const popularQueries = await ChatbotInteraction.aggregate([
         { $match: matchQuery },
         {
            $group: {
               _id: '$userMessage',
               count: { $sum: 1 },
               lastAsked: { $max: '$timestamp' },
               avgResponseTime: { $avg: '$responseTime' },
               kiosks: { $addToSet: '$kioskID' }
            }
         },
         { $sort: { count: -1 } },
         { $limit: parseInt(limit) },
         {
            $project: {
               query: '$_id',
               count: 1,
               lastAsked: 1,
               avgResponseTime: 1,
               uniqueKiosks: { $size: '$kiosks' },
               _id: 0
            }
         }
      ]);

      res.json({
         success: true,
         data: {
            queries: popularQueries,
            timeframe,
            dateRange: {
               start: startDate,
               end: now
            }
         }
      });
   } catch (error) {
      console.error('Error fetching popular queries:', error);
      res.status(500).json({
         success: false,
         error: 'Failed to fetch popular queries',
         message: error.message
      });
   }
});

// Get kiosk performance comparison
exports.getKioskPerformance = asyncHandler(async (req, res) => {
   try {
      const { timeframe = 'month' } = req.query;
      const now = new Date();
      let startDate;

      switch (timeframe) {
         case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
         case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
         case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
         default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const kioskPerformance = await ChatbotInteraction.aggregate([
         {
            $match: {
               timestamp: { $gte: startDate }
            }
         },
         {
            $group: {
               _id: '$kioskID',
               totalInteractions: { $sum: 1 },
               avgResponseTime: { $avg: '$responseTime' },
               uniqueSessions: {
                  $addToSet: {
                     $cond: [
                        { $ne: ['$sessionId', null] },
                        '$sessionId',
                        '$$REMOVE'
                     ]
                  }
               },
               actionBreakdown: {
                  $push: '$detectedLocation.action'
               },
               lastActivity: { $max: '$timestamp' }
            }
         },
         {
            $project: {
               kioskID: '$_id',
               totalInteractions: 1,
               avgResponseTime: { $round: ['$avgResponseTime', 2] },
               uniqueSessions: { $size: '$uniqueSessions' },
               avgInteractionsPerSession: {
                  $cond: [
                     { $gt: [{ $size: '$uniqueSessions' }, 0] },
                     {
                        $round: [
                           { $divide: ['$totalInteractions', { $size: '$uniqueSessions' }] },
                           2
                        ]
                     },
                     0
                  ]
               },
               lastActivity: 1,
               _id: 0
            }
         },
         { $sort: { totalInteractions: -1 } }
      ]);

      res.json({
         success: true,
         data: {
            performance: kioskPerformance,
            timeframe,
            dateRange: {
               start: startDate,
               end: now
            }
         }
      });
   } catch (error) {
      console.error('Error fetching kiosk performance:', error);
      res.status(500).json({
         success: false,
         error: 'Failed to fetch kiosk performance',
         message: error.message
      });
   }
});

// 4. Add validation middleware for logging endpoint
// Create this middleware function:
const validateLogInteraction = (req, res, next) => {
   const { kioskID, userMessage, aiResponse } = req.body;

   if (!kioskID || typeof kioskID !== 'string') {
      return res.status(400).json({
         success: false,
         error: 'Invalid kioskID',
         message: 'kioskID must be a non-empty string'
      });
   }

   if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({
         success: false,
         error: 'Invalid userMessage',
         message: 'userMessage must be a non-empty string'
      });
   }

   if (!aiResponse || typeof aiResponse !== 'string') {
      return res.status(400).json({
         success: false,
         error: 'Invalid aiResponse',
         message: 'aiResponse must be a non-empty string'
      });
   }

   next();
};

// Delete old interaction logs (for cleanup/maintenance)
exports.cleanupOldLogs = asyncHandler(async (req, res) => {
   try {
      const { daysOld = 365 } = req.body;

      const cutoffDate = new Date(Date.now() - parseInt(daysOld) * 24 * 60 * 60 * 1000);

      const result = await ChatbotInteraction.deleteMany({
         timestamp: { $lt: cutoffDate }
      });

      res.json({
         success: true,
         message: `Cleanup completed. Deleted ${result.deletedCount} old interaction logs.`,
         data: {
            deletedCount: result.deletedCount,
            cutoffDate
         }
      });
   } catch (error) {
      console.error('Error cleaning up old logs:', error);
      res.status(500).json({
         success: false,
         error: 'Failed to cleanup old logs',
         message: error.message
      });
   }
});

// Remove the conflicting module.exports - the exports.functionName syntax above is sufficient