const mongoose = require("mongoose");

const buildingPathSchema = new mongoose.Schema({
   path: { type: String, required: true },
});

module.exports = mongoose.model("BuildingPath", buildingPathSchema);