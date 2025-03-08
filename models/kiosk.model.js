const mongoose = require("mongoose");

const kioskSchema = new mongoose.Schema({
   kioskID: { type: String, required: true },
   name: { type: String, required: true },
   coordinates: { type: String, required: true },
   location: { type: String, required: true },
   status: { type: String, required: true },
   lastCheckIn: { type: Date, default: Date.now },
   addedBy: { type: String, required: true },
   addedByDate: { type: Date, default: Date.now },
   editedBy: { type: String, required: false },
   editedByDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Kiosk", kioskSchema);