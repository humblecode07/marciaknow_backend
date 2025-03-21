const mongoose = require("mongoose");

const navigationIconSchema = new mongoose.Schema({
   icon: { type: String, required: false },
});

module.exports = mongoose.model("NavigationIcon", navigationIconSchema);