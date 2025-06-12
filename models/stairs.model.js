const mongoose = require("mongoose");

const stairsSchema = new mongoose.Schema({
   id: { type: String, required: true },
   type: { type: String, enum: ["stairs"], default: "stairs" },
   x: { type: Number, required: true },
   y: { type: Number, required: true },
   width: { type: Number, required: true },
   height: { type: Number, required: true },
   label: { type: String, required: true },
   floor: { type: Number, required: true },
   direction: { type: String, enum: ["up", "down", "both"], required: true },
   createdAt: { type: Date, default: Date.now },
   updatedAt: { type: Date, default: Date.now }
});

module.exports = stairsSchema;
