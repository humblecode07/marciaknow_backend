const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { Readable } = require('stream');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const imageService = require('./image.service');

exports.add_room = asyncHandler(async (buildingID, kioskID, files, roomData) => {
   try {
      const building = await Building.findById(buildingID);
      if (!building) throw new Error("Building not found");

      const kiosk = await Kiosk.findOne({ kioskID });
      if (!kiosk) throw new Error("Kiosk not found");

      let rooms = building.existingRoom.get(kioskID) || [];

      const imageData = files?.length ? await imageService.process_images(files) : [];

      const navigationGuide = roomData.navigationGuide
         ? JSON.parse(roomData.navigationGuide).map(guide => ({
            icon: guide.icon,
            description: guide.description
         }))
         : [];

      let navigationPath = [];
      if (roomData.path) {
         try {
            navigationPath = JSON.parse(roomData.path);
         } catch (err) {
            console.error('Invalid navigation path JSON:', err);
         }
      }

      const newRoom = {
         name: roomData.name,
         description: roomData.description,
         floor: roomData.floor,
         navigationPath,
         navigationGuide,
         image: imageData
      };

      rooms.push(newRoom);
      building.existingRoom.set(kioskID, rooms);

      building.markModified('existingRoom');
      await building.save();

      return newRoom;
   } catch (error) {
      console.error("Error adding room:", error);
      throw error;
   }
});


exports.edit_room = asyncHandler(async (buildingID, kioskID, files, roomData) => {

})