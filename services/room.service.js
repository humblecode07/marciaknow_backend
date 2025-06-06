const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const asyncHandler = require('express-async-handler');
const imageService = require('./image.service');

exports.add_room = asyncHandler(async (buildingID, kioskID, files, roomData) => {
   try {
      const building = await Building.findById(buildingID);
      if (!building) throw new Error("Building not found");

      const kiosk = await Kiosk.findOne({ kioskID });
      if (!kiosk) throw new Error("Selected kiosk not found");

      // 🔹 Get all kioskIDs in the system
      const allKioskIDs = (await Kiosk.find({}, 'kioskID').lean()).map(k => k.kioskID);

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

      // 🔹 Loop through all kioskIDs to add room to each
      for (const kID of allKioskIDs) {
         let rooms = building.existingRoom.get(kID) || [];

         if (kID === kioskID) {
            // Full data only for the selected kiosk
            rooms.push({
               name: roomData.name,
               description: roomData.description,
               floor: roomData.floor,
               navigationPath,
               navigationGuide,
               image: imageData,
               addedByDate: new Date(),
               editedByDate: new Date()
            });
         } else {
            // Basic info only for other kiosks
            rooms.push({
               name: roomData.name,
               description: roomData.description,
               floor: roomData.floor,
               image: imageData,
               addedByDate: new Date(),
               editedByDate: new Date()
            });
         }

         building.existingRoom.set(kID, rooms);
      }

      building.markModified('existingRoom');
      await building.save();

      return {
         message: 'Room added to all kiosks successfully',
         kioskID, // the one with full data
      };
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

exports.delete_room_from_all_kiosks = asyncHandler(async (buildingID, roomName, floor) => {
   try {
      const building = await Building.findById(buildingID);
      if (!building) throw new Error('Building not found');

      console.log(`Deleting room "${roomName}" on floor ${floor} from all kiosks in building ${buildingID}`);

      let allImagesToDelete = [];
      let deletedCount = 0;
      let kiosksModified = [];
      let deletedRoomIds = []; // Track all deleted room IDs for reference

      // Iterate through all kiosks in the existingRoom Map
      for (const [kioskID, rooms] of building.existingRoom.entries()) {
         console.log(`Checking kiosk ${kioskID} with ${rooms.length} rooms`);

         // Find rooms with matching name and floor (going backwards to safely remove)
         for (let i = rooms.length - 1; i >= 0; i--) {
            const room = rooms[i];

            // Match by name and floor instead of _id
            if (room.name === roomName && room.floor === floor) {
               console.log(`Found matching room "${roomName}" on floor ${floor} in kiosk ${kioskID} with ID: ${room._id}`);

               // Collect images for cleanup
               if (room.image && room.image.length > 0) {
                  const imageIds = room.image.map(img => img._id.toString());
                  allImagesToDelete.push(...imageIds);
               }

               // Store the room ID before deletion
               deletedRoomIds.push(room._id.toString());

               // Remove the room
               rooms.splice(i, 1);
               deletedCount++;

               if (!kiosksModified.includes(kioskID)) {
                  kiosksModified.push(kioskID);
               }
            }
         }
      }

      if (deletedCount === 0) {
         throw new Error(`Room "${roomName}" on floor ${floor} not found in any kiosk`);
      }

      // Mark all modified kiosks as changed
      kiosksModified.forEach(kioskID => {
         building.markModified(`existingRoom.${kioskID}`);
      });

      // Save the building
      await building.save();

      // Delete all collected images
      if (allImagesToDelete.length > 0) {
         await imageService.delete_images(allImagesToDelete);
         console.log(`Deleted ${allImagesToDelete.length} images`);
      }

      console.log(`Successfully deleted room "${roomName}" on floor ${floor} from ${deletedCount} kiosk(s) in building ${buildingID}`);

      return {
         deletedFromKiosks: kiosksModified,
         totalDeletedRooms: deletedCount,
         deletedRoomIds: deletedRoomIds, // Return the actual IDs that were deleted
         deletedImages: allImagesToDelete.length,
         buildingId: buildingID,
         roomName: roomName,
         floor: floor
      };

   } catch (error) {
      console.error(`Failed to delete room "${roomName}" on floor ${floor} from all kiosks in building ${buildingID}:`, error.message);
      throw error;
   }
});