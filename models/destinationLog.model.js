const mongoose = require('mongoose');

const destinationLogSchema = new mongoose.Schema({
  buildingId: {
    type: String,
    required: true,
  },
  roomId: {
    type: String,
    default: null,
  },
  searchQuery: {
    type: String,
    required: true,
  },
  destinationType: {
    type: String,
    enum: ['building', 'room'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  sessionId: {
    type: String,
    default: null,
  },
  kioskId: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
destinationLogSchema.index({ timestamp: -1 });
destinationLogSchema.index({ buildingId: 1, timestamp: -1 });
destinationLogSchema.index({ destinationType: 1, timestamp: -1 });

module.exports = mongoose.model('DestinationLog', destinationLogSchema);