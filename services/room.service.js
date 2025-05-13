const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const asyncHandler = require('express-async-handler');
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

   // Handle image processing
   const newImages = files?.length ? await imageService.process_images(files) : [];

   // Process navigation guide
   const navigationGuide = roomData.navigationGuide
      ? JSON.parse(roomData.navigationGuide).map(guide => ({
         icon: guide.icon,
         description: guide.description
      }))
      : [];

   // Process navigation path
   let navigationPath = [];
   if (roomData.path) {
      try {
         navigationPath = JSON.parse(roomData.path);
      } catch (err) {
         console.error('Invalid navigation path JSON:', err);
      }
   }

   // Ensure imageIDs is properly parsed if it came as a string
   let updatedImageIDs = [];
   if (roomData.imageIDs) {
      updatedImageIDs = Array.isArray(roomData.imageIDs)
         ? roomData.imageIDs
         : JSON.parse(roomData.imageIDs);
   }

   // Find images that need to be deleted - we'll delete by file_path instead of _id
   const imagesToDelete = existingRoom.image.filter(img =>
      !updatedImageIDs.includes(img._id.toString())
   );

   console.log('Images to delete:', imagesToDelete.map(img => img.file_path));

   // Delete unused images from GridFS
   if (imagesToDelete.length > 0) {
      try {
         await imageService.delete_images(imagesToDelete);
      } catch (deleteErr) {
         console.error('Error during image deletion:', deleteErr);
         // Continue execution even if image deletion fails
      }
   }

   // Make sure we properly filter retained images
   const retainedImages = existingRoom.image.filter(img =>
      updatedImageIDs.includes(img._id.toString())
   );

   // Update the room with new data and images
   rooms[roomIndex] = {
      ...existingRoom._doc, // preserve existing fields that shouldn't change
      name: roomData.name,
      description: roomData.description,
      floor: roomData.floor,
      navigationPath,
      navigationGuide,
      image: [
         ...retainedImages, // Retain selected old images
         ...newImages // Add new images
      ]
   };

   // Update the building document
   building.existingRoom.set(kioskID, rooms);
   building.markModified('existingRoom');
   await building.save();

   // Return the updated room data
   return rooms[roomIndex];
});
