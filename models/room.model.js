const mongoose = require("mongoose");
const navigationPathSchema = require("./navigationPath.model");
const navigationGuideSchema = require("./navigationGuide.model");
const imageSchema = require("./image.model");

const roomSchema = new mongoose.Schema({
   name: { type: String, required: true },
   description: { type: String, required: false },
   floor: { type: Number, required: true },
   image: [imageSchema],
   navigationPath: [navigationPathSchema],
   addedBy: { type: String, required: false },
   addedByDate: { type: Date, default: Date.now },
   editedBy: { type: String, required: false },
   editedByDate: { type: Date, default: Date.now }
});

roomSchema.pre("save", function (next) {
   if (this.isModified("editedBy")) {
      this.editedByDate = Date.now();
   }
   next();
});

module.exports = roomSchema;