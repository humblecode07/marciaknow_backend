const mongoose = require("mongoose");

const kioskSchema = new mongoose.Schema({
   kioskID: { type: String, required: true },
   name: { type: String, required: true },
   coordinates: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
   },
   location: { type: String, required: true },
   status: { type: String, required: true, enum: ["online", "offline", "maintenance"], default: "offline" },
   lastCheckIn: { type: Date, default: Date.now },
   addedBy: { type: String, required: false },  // Made optional for now
   addedByDate: { type: Date, default: Date.now },
   editedBy: { type: String, required: false },  // Made optional for now
   editedByDate: { type: Date, default: Date.now },
});

kioskSchema.pre("save", function (next) {
   if (this.isModified("editedBy")) {
      this.editedByDate = Date.now();
   }
   next();
});

module.exports = mongoose.model("Kiosk", kioskSchema);
