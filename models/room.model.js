const mongoose = require("mongoose");
const navigationPathSchema = require("./navigationPath.model");
const navigationGuideSchema = require("./navigationGuide.model");

const roomSchema = new mongoose.Schema({
   name: { type: String, required: true },
   description: { type: String, required: false },
   floor: { type: Number, required: true },
   navigationGuide: [navigationGuideSchema],
   image: [imageSchema],
   navigationPath: [navigationPathSchema],
   addedBy: { type: String, required: true },
   addedByDate: { type: Date, default: Date.now },
   editedBy: { type: String, required: false },
   editedByDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Room", roomSchema);