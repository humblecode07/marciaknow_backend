const mongoose = require("mongoose");

const navigationPathSchema = new mongoose.Schema({
   x: { type: Number, required: false },
   y: { type: Number, required: false }
}, { _id: false });

module.exports = navigationPathSchema;