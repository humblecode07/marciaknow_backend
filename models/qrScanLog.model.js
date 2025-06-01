// models/QrScanLog.js
const mongoose = require('mongoose');

const qrScanLogSchema = new mongoose.Schema({
   buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Building'
   },
   buildingName: {
      type: String,
      required: true,
      trim: true
   },
   kioskId: {
      type: String,
      required: true,
      trim: true
   },
   scannedAt: {
      type: Date,
      default: Date.now
   },
   ipAddress: {
      type: String,
      trim: true
   },
   userAgent: {
      type: String,
      trim: true
   },
   referrer: {
      type: String,
      trim: true
   },
   sessionId: {
      type: String,
      trim: true
   }
}, {
   timestamps: true
});

// Index for better query performance
qrScanLogSchema.index({ scannedAt: -1 });
qrScanLogSchema.index({ kioskId: 1, scannedAt: -1 });
qrScanLogSchema.index({ buildingId: 1, scannedAt: -1 });

// Static method to get daily scan counts
qrScanLogSchema.statics.getDailyScanCounts = function (startDate, endDate, filters = {}) {
   const matchStage = {
      scannedAt: {
         $gte: new Date(startDate),
         $lte: new Date(endDate)
      }
   };

   // Add optional filters
   if (filters.kioskId) {
      matchStage.kioskId = filters.kioskId;
   }
   if (filters.buildingId) {
      matchStage.buildingId = new mongoose.Types.ObjectId(filters.buildingId);
   }

   return this.aggregate([
      { $match: matchStage },
      {
         $group: {
            _id: {
               year: { $year: '$scannedAt' },
               month: { $month: '$scannedAt' },
               day: { $dayOfMonth: '$scannedAt' }
            },
            totalScans: { $sum: 1 },
            date: { $first: '$scannedAt' }
         }
      },
      {
         $project: {
            _id: 0,
            reportDate: {
               $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$date'
               }
            },
            totalScans: 1
         }
      },
      { $sort: { reportDate: -1 } }
   ]);
};

// Static method to get total scan count
qrScanLogSchema.statics.getTotalScanCount = function (filters = {}) {
   const matchStage = {};

   if (filters.kioskId) {
      matchStage.kioskId = filters.kioskId;
   }
   if (filters.buildingId) {
      matchStage.buildingId = new mongoose.Types.ObjectId(filters.buildingId);
   }

   return this.countDocuments(matchStage);
};

module.exports = mongoose.model('QrScanLog', qrScanLogSchema);