const mongoose = require("mongoose");

const navigationGuideSchema = new mongoose.Schema({
   icon: { type: String, required: false }, // false for now
   direction: { type: String, required: false },
});

module.exports = navigationGuideSchema;