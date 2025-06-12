const mongoose = require("mongoose");
const navigationGuideSchema = require("./navigationGuide.model");
const imageSchema = require("./image.model");

const roomSchema = new mongoose.Schema({
   id: { type: String, required: true }, // matches your JSON format
   x: { type: Number, required: true },
   y: { type: Number, required: true },
   width: { type: Number, required: true },
   height: { type: Number, required: true },
   label: { type: String, required: true }, // "Room 1", "Room 2", etc.
   color: { type: String, required: true }, // hex color codes
   floor: { type: Number, required: true },
   navigationPath: [{
      x: { type: Number, required: true },
      y: { type: Number, required: true }
   }],
   navigationGuide: [navigationGuideSchema],
   images: [imageSchema], 
   imageIds: [{ type: String }], 
   createdAt: { type: Date, default: Date.now },
   updatedAt: { type: Date, default: Date.now },
   description: { type: String, required: false }
});

roomSchema.pre("save", function (next) {
   if (this.isModified("editedBy")) {
      this.editedByDate = Date.now();
   }
   next();
});

module.exports = roomSchema;