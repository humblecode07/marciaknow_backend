// services/chatbot.service.js
const ChatbotInteraction = require('../models/chatbot.model');

// Function to log chatbot interactions
const logChatbotInteraction = async (interactionData) => {
   try {
      const interaction = new ChatbotInteraction(interactionData);
      await interaction.save();
      return interaction;
   } catch (error) {
      console.error('Error logging chatbot interaction:', error);
      throw error;
   }
};

// Function to get chatbot metrics for reports
const getChatbotMetrics = async (timeframe = 'month', kioskID = null) => {
   try {
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

      // Get basic metrics
      const totalInteractions = await ChatbotInteraction.countDocuments(matchQuery);

      // Get daily interactions
      const dailyInteractions = await ChatbotInteraction.aggregate([
         { $match: matchQuery },
         {
            $group: {
               _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
               },
               count: { $sum: 1 },
               avgResponseTime: { $avg: '$responseTime' }
            }
         },
         { $sort: { '_id': 1 } }
      ]);

      // Get most common queries/topics
      const commonQueries = await ChatbotInteraction.aggregate([
         { $match: matchQuery },
         {
            $group: {
               _id: '$userMessage',
               count: { $sum: 1 },
               lastAsked: { $max: '$timestamp' }
            }
         },
         { $sort: { count: -1 } },
         { $limit: 10 }
      ]);

      // Get action breakdown (navigate, search, info)
      const actionBreakdown = await ChatbotInteraction.aggregate([
         { $match: matchQuery },
         {
            $group: {
               _id: '$detectedLocation.action',
               count: { $sum: 1 }
            }
         },
         { $sort: { count: -1 } }
      ]);

      // Get location detection accuracy
      const locationDetectionStats = await ChatbotInteraction.aggregate([
         { $match: matchQuery },
         {
            $group: {
               _id: '$detectedLocation.confidence',
               count: { $sum: 1 }
            }
         }
      ]);

      // Get kiosk activity
      const kioskActivity = await ChatbotInteraction.aggregate([
         { $match: matchQuery },
         {
            $group: {
               _id: '$kioskID',
               interactions: { $sum: 1 },
               avgResponseTime: { $avg: '$responseTime' }
            }
         },
         { $sort: { interactions: -1 } }
      ]);

      // Get average response time
      const avgResponseTime = await ChatbotInteraction.aggregate([
         { $match: matchQuery },
         {
            $group: {
               _id: null,
               avgTime: { $avg: '$responseTime' }
            }
         }
      ]);

      return {
         totalInteractions,
         dailyInteractions,
         commonQueries,
         actionBreakdown,
         locationDetectionStats,
         kioskActivity,
         avgResponseTime: avgResponseTime[0]?.avgTime || 0,
         timeframe,
         dateRange: {
            start: startDate,
            end: now
         }
      };
   } catch (error) {
      console.error('Error getting chatbot metrics:', error);
      throw error;
   }
};

module.exports = {
   logChatbotInteraction,
   getChatbotMetrics
};