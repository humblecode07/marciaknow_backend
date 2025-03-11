const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

exports.add_room = asyncHandler(async (req, res) => {
   try {
      const building = await Building.findById(req.body.id);
      if (!building) return res.status(404).json({ message: "Building not found" });

      const kiosk = await Kiosk.findOne({ kioskID: req.body.kioskID });
      if (!kiosk) return res.status(404).json({ message: "Kiosk not found" });

      let rooms = building.existingRoom.get(req.body.kioskID) || [];

      const navigationGuide = req.body.navigationGuide?.map(guide => ({
         icon: guide.icon,
         text: guide.text
      })) || [];

      const newRoom = {
         name: req.body.name,
         description: req.body.description,
         floor: req.body.floor,
         navigationPath: req.body.path,
         navigationGuide: navigationGuide
      };

      rooms.push(newRoom);

      building.existingRoom.set(req.body.kioskID, rooms);

      // Critical: Mark the field as modified so Mongoose knows to save the changes
      building.markModified('existingRoom');

      await building.save();

      res.status(201).json({
         success: true,
         message: "Room added successfully",
      });
   }
   catch (error) {
      console.error("Error adding room:", error);
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
});