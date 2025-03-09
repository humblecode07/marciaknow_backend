const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
   aspect_ratio: { type: Number, required: true },
   height: { type: Number, required: true },
   width: { type: Number, required: true },
   file_path: { type: String, required: false },
});

module.exports = imageSchema;