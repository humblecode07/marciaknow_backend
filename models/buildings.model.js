const mongoose = require("mongoose");
const navigationPathSchema = require("./navigationPath.model");
const navigationGuideSchema = require("./navigationGuide.model");
const imageSchema = require("./image.model");
const roomSchema = require("./room.model");

const buildingSchema = new mongoose.Schema({
   id: { type: Number, required: true },
   name: { type: String, required: true },
   description: { type: String, required: false },
   path: { type: String, required: true },
   numberOfFloor: { type: Number, required: true },
   existingRoom: [roomSchema],
   navigationPath: [navigationPathSchema],
   image: [imageSchema],
   navigationGuide: [navigationGuideSchema],
});

module.exports = mongoose.model("Building", buildingSchema);