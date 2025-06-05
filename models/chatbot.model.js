// models/chatbot.model.js
const mongoose = require('mongoose');

// Define a sub-schema for detectedLocation
const detectedLocationSchema = new mongoose.Schema({
   name: { type: String, required: false }, // Make required false if it can be empty
   type: { type: String, required: false }, // building/room/null
   confidence: { type: String, required: false }, // high/medium/low
   action: { type: String, required: false } // navigate/search/info/null
}, { _id: false }); // _id: false means Mongoose won't add an _id to this subdocument

const chatbotInteractionSchema = new mongoose.Schema({
   kioskID: {
      type: String,
      required: true
   },
   userMessage: {
      type: String,
      required: true
   },
   aiResponse: {
      type: String,
      required: true
   },
   // Refer to the sub-schema here
   detectedLocation: detectedLocationSchema, // <--- CHANGE THIS LINE
   responseTime: {
      type: Number, // in milliseconds
      default: 0
   },
   timestamp: {
      type: Date,
      default: Date.now
   },
   sessionId: String // to track conversation sessions
});

// Add indexes for better query performance
chatbotInteractionSchema.index({ kioskID: 1, timestamp: -1 });
chatbotInteractionSchema.index({ timestamp: -1 });
chatbotInteractionSchema.index({ 'detectedLocation.action': 1 });

module.exports = mongoose.model('ChatbotInteraction', chatbotInteractionSchema);