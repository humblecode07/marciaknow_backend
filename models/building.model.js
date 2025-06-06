const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);
const navigationPathSchema = require("./navigationPath.model");
const navigationGuideSchema = require("./navigationGuide.model");
const imageSchema = require("./image.model");
const roomSchema = require("./room.model");

const buildingSchema = new mongoose.Schema({
   id: { type: Number },
   name: { type: String, required: true },
   description: { type: String, required: false },
   path: { type: String, required: true },
   numberOfFloor: { type: Number, required: true },
   existingRoom: {
      type: Map,
      of: [roomSchema],
      default: {}
   },
   navigationPath: {
      type: Map,
      of: [navigationPathSchema], // one navigation path per kiosk
      default: {}
   },
   image: [imageSchema],
   navigationGuide: {
      type: Map,
      of: [navigationGuideSchema], // one navigation guide per kiosk
      default: {}
   },
});

buildingSchema.plugin(AutoIncrement, { inc_field: "id" })

module.exports = mongoose.model("Building", buildingSchema);