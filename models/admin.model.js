const mongoose = require('mongoose');

const superAdminRole = Number(process.env.ROLE_SUPER_ADMIN);
const adminRole = Number(process.env.ROLE_ADMIN);

const adminSchema = new mongoose.Schema({
   full_name: { type: String, required: true, maxLength: 420 },
   email: { type: String, required: true, unique: true, match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ },
   username: { type: String },
   password: { type: String, required: true, minLength: 8, maxLength: 64 },
   profile: { type: String },
   roles: {
      type: [Number],
      enum: [superAdminRole, adminRole],
      default: [adminRole]
   },
   refreshToken: { type: String },
   description: { type: String },
   contact: { type: String },
   lastLogin: { type: Date },
   joined: { type: Date },
   status: { type: String, required: true, enum: ["online", "offline"], default: "offline" },
   isDisabled: { type: Boolean, default: false },
   systemLogs: {
      kiosk: {
         description: { type: String },
         kioskID: { type: String },
         location: { type: String },
         dateOfChange: { type: Date }
      },
      mapEditor: {
         room: [{
            description: { type: String },
            buildingName: { type: String },
            floor: { type: Number },
            kioskName: { type: String },
            dateOfChange: { type: Date }
         }],
         building: [{
            description: { type: String },
            floor: { type: Number },
            kioskName: { type: String },
            buildingId: { type: String }, // Added for better tracking
            buildingName: { type: String }, // Added for better tracking
            dateOfChange: { type: Date }
         }]
      }
   }
});

adminSchema.index({ 'systemLogs.mapEditor.building.dateOfChange': -1 });
adminSchema.index({ 'systemLogs.mapEditor.room.dateOfChange': -1 });
adminSchema.index({ 'systemLogs.kiosk.dateOfChange': -1 });

module.exports = mongoose.model("Admins", adminSchema)