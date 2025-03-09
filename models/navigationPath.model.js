const mongoose = require("mongoose");

const navigationPathSchema = new mongoose.Schema({
   path: { type: String, required: true },
});

module.exports = navigationPathSchema;