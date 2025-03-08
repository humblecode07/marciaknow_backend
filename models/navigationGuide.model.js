const mongoose = require("mongoose");

const navigationPathSchema = new mongoose.Schema({
   icon: { type: String, required: false }, // false for now
   direction: { type: String, required: true },
});

module.exports = mongoose.model("NavigationPath", navigationPathSchema);