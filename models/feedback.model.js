const mongoose = require('mongoose');
const imageSchema = require("./image.model");

const feedbackSchema = new mongoose.Schema({
   message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
   },
   category: {
      type: String,
      required: true,
      enum: ['Bug', 'Suggestion', 'Complaint', 'Praise'],
      default: 'Suggestion'
   },
   kioskLocation: {
      type: String,
      trim: true,
      maxlength: 100
   },
   pageSection: {
      type: String,
      trim: true,
      maxlength: 100
   },
   status: {
      type: String,
      enum: ['New', 'Reviewed', 'In Progress', 'Resolved'],
      default: 'New'
   },
   userEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
   },
   userPhone: {
      type: String,
      trim: true
   },
   priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
   },
   assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
   },
   adminNotes: {
      type: String,
      maxlength: 1000
   },
   attachments: [imageSchema],
   ipAddress: String,
   userAgent: String,
   sessionId: String
}, {
   timestamps: true
});

// Indexes for better query performance
feedbackSchema.index({ category: 1, status: 1 });
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ kioskLocation: 1 });

// Virtual for formatted date
feedbackSchema.virtual('formattedDate').get(function () {
   return this.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
   });
});

module.exports = mongoose.model('Feedback', feedbackSchema);