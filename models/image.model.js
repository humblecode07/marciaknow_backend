const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
   aspect_ratio: { type: Number, required: false },
   height: { type: Number, required: false },
   width: { type: Number, required: false },
   file_path: { type: String, required: false },
});

module.exports = imageSchema;