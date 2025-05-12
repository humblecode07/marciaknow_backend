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
   }
   catch (error) {
      console.error("Error adding room:", error);
      throw error;
   }
});


exports.edit_room = asyncHandler(async (buildingID, kioskID, roomID, files, roomData) => {
   const building = await Building.findById(buildingID);
   if (!building) throw new Error("Building not found");

   const kiosk = await Kiosk.findOne({ kioskID });
   if (!kiosk) throw new Error("Kiosk not found");

   let rooms = building.existingRoom.get(kioskID) || [];

   // Find index of the room to edit
   const roomIndex = rooms.findIndex(room => room._id.toString() === roomID);
   if (roomIndex === -1) throw new Error("Room not found");

   const existingRoom = rooms[roomIndex];

   // Parse and prepare incoming data
   const newImages = files?.length ? await imageService.process_images(files) : [];

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

   // Compare old vs new images to find which ones to delete
   const updatedImageIDs = roomData.imageIDs || []; // frontend should send list of retained image IDs
   const imagesToDelete = existingRoom.image.filter(img => !updatedImageIDs.includes(img._id.toString()));

   // Delete unused images from GridFS
   await imageService.delete_images(imagesToDelete);

   // Update room object
   rooms[roomIndex] = {
      ...existingRoom._doc, // maintain _id and other untouched props
      name: roomData.name,
      description: roomData.description,
      floor: roomData.floor,
      navigationPath,
      navigationGuide,
      image: [...existingRoom.image.filter(img => updatedImageIDs.includes(img._id.toString())), ...newImages]
   };

   building.existingRoom.set(kioskID, rooms);
   building.markModified('existingRoom');
   await building.save();

   return rooms[roomIndex];
})