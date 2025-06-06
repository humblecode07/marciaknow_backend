const mongoose = require('mongoose');

const aiAnalyticsSchema = new mongoose.Schema({
   // Basic interaction info
   kioskId: {
      type: String,
      required: true
   },
   sessionId: {
      type: String,
      required: true
   },

   // User query data
   userQuestion: {
      type: String,
      required: true
   },
   questionCategory: {
      type: String,
      enum: ['navigation', 'building_info', 'room_search', 'general', 'unclear'],
      default: 'general'
   },

   // AI response data
   aiResponse: {
      type: String,
      required: true
   },
   responseTime: {
      type: Number, // milliseconds
      required: true
   },

   // Location detection results
   detectedLocation: {
      name: String,
      type: {
         type: String,
         enum: ['building', 'room', null],
         default: null
      },
      confidence: {
         type: String,
         enum: ['high', 'medium', 'low', null],
         default: null
      },
      action: {
         type: String,
         enum: ['navigate', 'search', 'info', null],
         default: null
      }
   },

   // Success metrics
   isSuccessful: {
      type: Boolean,
      default: null // Will be set based on user feedback or follow-up actions
   },
   errorOccurred: {
      type: Boolean,
      default: false
   },
   errorMessage: String,

   // User feedback (if collected)
   userFeedback: {
      rating: {
         type: Number,
         min: 1,
         max: 5
      },
      helpful: Boolean,
      comments: String
   },

   // Technical data
   modelUsed: {
      type: String,
      default: 'llama3-8b-8192'
   },
   promptTokens: Number,
   completionTokens: Number,
   totalTokens: Number,

   // Context data
   buildingsInContext: [{
      buildingId: mongoose.Schema.Types.ObjectId,
      buildingName: String
   }],

   // Follow-up tracking
   hasFollowUp: {
      type: Boolean,
      default: false
   },
   followUpQuestions: [String],

   // Timestamps
   createdAt: {
      type: Date,
      default: Date.now
   },
   updatedAt: {
      type: Date,
      default: Date.now
   }
}, {
   timestamps: true
});

// Indexes for better query performance
aiAnalyticsSchema.index({ kioskId: 1, createdAt: -1 });
aiAnalyticsSchema.index({ questionCategory: 1 });
aiAnalyticsSchema.index({ 'detectedLocation.confidence': 1 });
aiAnalyticsSchema.index({ isSuccessful: 1 });
aiAnalyticsSchema.index({ createdAt: -1 });

// Methods for analytics
aiAnalyticsSchema.statics.getSuccessRate = async function (dateRange = {}) {
   const match = { isSuccessful: { $ne: null } };
   if (dateRange.start) match.createdAt = { $gte: dateRange.start };
   if (dateRange.end) match.createdAt = { ...match.createdAt, $lte: dateRange.end };

   const results = await this.aggregate([
      { $match: match },
      {
         $group: {
            _id: null,
            total: { $sum: 1 },
            successful: { $sum: { $cond: ['$isSuccessful', 1, 0] } }
         }
      },
      {
         $project: {
            successRate: { $multiply: [{ $divide: ['$successful', '$total'] }, 100] },
            total: 1,
            successful: 1
         }
      }
   ]);

   return results[0] || { successRate: 0, total: 0, successful: 0 };
};

aiAnalyticsSchema.statics.getAverageResponseTime = async function (dateRange = {}) {
   const match = {};
   if (dateRange.start) match.createdAt = { $gte: dateRange.start };
   if (dateRange.end) match.createdAt = { ...match.createdAt, $lte: dateRange.end };

   const results = await this.aggregate([
      { $match: match },
      {
         $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' },
            count: { $sum: 1 }
         }
      }
   ]);

   return results[0] || { avgResponseTime: 0, count: 0 };
};

aiAnalyticsSchema.statics.getQuestionCategoryStats = async function (dateRange = {}) {
   const match = {};
   if (dateRange.start) match.createdAt = { $gte: dateRange.start };
   if (dateRange.end) match.createdAt = { ...match.createdAt, $lte: dateRange.end };

   return await this.aggregate([
      { $match: match },
      {
         $group: {
            _id: '$questionCategory',
            count: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTime' },
            successRate: {
               $avg: {
                  $cond: [
                     { $eq: ['$isSuccessful', true] }, 1,
                     { $cond: [{ $eq: ['$isSuccessful', false] }, 0, null] }
                  ]
               }
            }
         }
      },
      { $sort: { count: -1 } }
   ]);
};

aiAnalyticsSchema.statics.getPopularLocations = async function (limit = 10, dateRange = {}) {
   const match = { 'detectedLocation.name': { $ne: null } };
   if (dateRange.start) match.createdAt = { $gte: dateRange.start };
   if (dateRange.end) match.createdAt = { ...match.createdAt, $lte: dateRange.end };

   return await this.aggregate([
      { $match: match },
      {
         $group: {
            _id: '$detectedLocation.name',
            count: { $sum: 1 },
            type: { $first: '$detectedLocation.type' },
            avgConfidence: {
               $avg: {
                  $cond: [
                     { $eq: ['$detectedLocation.confidence', 'high'] }, 3,
                     { $cond: [{ $eq: ['$detectedLocation.confidence', 'medium'] }, 2, 1] }
                  ]
               }
            }
         }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
   ]);
};

module.exports = mongoose.model('AIAnalytics', aiAnalyticsSchema);