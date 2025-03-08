const mongoose = require("mongoose");

const navigationPathSchema = new mongoose.Schema({
   kioskId: { type: String, required: true },
   path: { type: String, required: true },
});

module.exports = mongoose.model("NavigationPath", navigationPathSchema);