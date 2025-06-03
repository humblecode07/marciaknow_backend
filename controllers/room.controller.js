const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const room_service = require('../services/room.service');
const systemLogService = require('../services/systemLog.service');

const extractAdminId = (req) => {
   return req.user?.id || req.adminId;
};

exports.get_all_rooms = asyncHandler(async (req, res) => {
   try {
      const buildings = await Building.find().lean(); // Using lean() to get plain JS objects
      let allRooms = [];

      buildings.forEach(building => {
         const existingRoom = building.existingRoom;

         // Check if existingRoom exists and is an object
         if (existingRoom && typeof existingRoom === 'object') {
            // Get all kiosk IDs
            const kioskIDs = Object.keys(existingRoom);

            kioskIDs.forEach(kioskID => {
               const roomsForKiosk = existingRoom[kioskID];

               // Check if roomsForKiosk is an array
               if (Array.isArray(roomsForKiosk)) {
                  roomsForKiosk.forEach(room => {
                     allRooms.push({
                        ...room,
                        kioskID,
                        buildingID: building._id,
                        buildingName: building.name
                     });
                  });
               }
            });
         }
      });

      res.json(allRooms);
   }
   catch (error) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ message: 'Unexpected error: ' + error.message });
   }
});

exports.get_rooms_for_kiosk = asyncHandler(async (req, res) => {
   const { kioskID } = req.params;

   try {
      const buildings = await Building.find().lean();
      let roomsForKiosk = [];

      buildings.forEach(building => {
         const existingRoom = building.existingRoom;

         if (existingRoom && typeof existingRoom === 'object') {
            // Check if this building has rooms for the kioskID we want
            if (existingRoom[kioskID] && Array.isArray(existingRoom[kioskID])) {
               existingRoom[kioskID].forEach(room => {
                  roomsForKiosk.push({
                     ...room,
                     kioskID,
                     buildingID: building._id,
                     buildingName: building.name
                  });
               });
            }
         }
      });

      res.json(roomsForKiosk);
   }
   catch (error) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ message: 'Unexpected error: ' + error.message });
   }
});


exports.get_room_from_building = asyncHandler(async (req, res) => {
   try {
      const { buildingID, roomID } = req.params;

      const building = await Building.findById(buildingID).lean();

      if (!building) {
         return res.status(404).json({ message: 'Building not found' });
      }

      let foundRoom = null;
      const roomsByKiosk = building.existingRoom;

      for (const [kioskID, roomList] of Object.entries(roomsByKiosk || {})) {
         const room = roomList.find(r => r._id?.toString() === roomID);
         if (room) {
            foundRoom = {
               ...room,
               kioskID,
               buildingID: building._id,
               buildingName: building.name
            };
            break;
         }
      }

      if (!foundRoom) {
         return res.status(404).json({ message: 'Room not found in this building' });
      }

      res.json(foundRoom);
   }
   catch (error) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ message: 'Unexpected error: ' + error.message });
   }
});

exports.add_room = asyncHandler(async (req, res) => {
   try {
      const { buildingID, kioskID } = req.params;
      const files = req.files;

      const room = await room_service.add_room(buildingID, kioskID, files, req.body);

      return res.status(201).json({
         success: true,
         message: "Room added successfully",
         data: room
      });
   }
   catch (error) {
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
});

exports.edit_room = asyncHandler(async (req, res) => {
   const { buildingID, roomID, kioskID } = req.params;

   try {
      const building = await Building.findById(buildingID);
      if (!building) throw new Error("Building not found");

      const kiosk = await Kiosk.findOne({ kioskID });
      if (!kiosk) throw new Error("Kiosk not found");

      let rooms = building.existingRoom.get(kioskID) || [];
      const roomIndex = rooms.findIndex(room => room._id.toString() === roomID);
      if (roomIndex === -1) throw new Error("Room not found");

      const existingRoom = rooms[roomIndex];

      // Store original data for comparison
      const originalData = {
         name: existingRoom.name,
         description: existingRoom.description,
         floor: existingRoom.floor,
         imageCount: existingRoom.image?.length || 0,
         navigationGuide: existingRoom.navigationGuide || [],
         navigationPath: existingRoom.navigationPath || []
      };

      const { name, description, floor, path, navigationGuide } = req.body;
      const files = req.files;

      // Handle image processing
      const newImages = files?.length ? await imageService.process_images(files) : [];

      let retainedImageIDs = [];
      if (req.body.imageIDs) {
         retainedImageIDs = Array.isArray(req.body.imageIDs)
            ? req.body.imageIDs
            : JSON.parse(req.body.imageIDs);
      }

      const imagesToDelete = existingRoom.image?.filter(img =>
         !retainedImageIDs.includes(img._id.toString())
      ) || [];

      if (imagesToDelete.length > 0) {
         try {
            await imageService.delete_images(imagesToDelete);
         } catch (deleteErr) {
            console.error('Error deleting images:', deleteErr);
         }
      }

      const retainedImages = existingRoom.image?.filter(img =>
         retainedImageIDs.includes(img._id.toString())
      ) || [];

      // Helper functions
      const hasContent = (value) => {
         if (!value) return false;
         if (typeof value === 'string') {
            try {
               const parsed = JSON.parse(value);
               return Array.isArray(parsed) ? parsed.length > 0 : !!parsed;
            } catch {
               return value.trim().length > 0;
            }
         }
         return Array.isArray(value) ? value.length > 0 : !!value;
      };

      const arraysEqual = (a, b) => {
         if (!Array.isArray(a) || !Array.isArray(b)) return false;
         if (a.length !== b.length) return false;
         return JSON.stringify(a) === JSON.stringify(b);
      };

      // Process navigation guide
      let processedNavigationGuide = originalData.navigationGuide;
      let navigationGuideChanged = false;

      if (hasContent(navigationGuide)) {
         const guideArray = JSON.parse(navigationGuide).map(guide => ({
            icon: guide.icon,
            description: guide.description
         }));

         if (!arraysEqual(originalData.navigationGuide, guideArray)) {
            processedNavigationGuide = guideArray;
            navigationGuideChanged = true;
         }
      }

      // Process navigation path
      let processedNavigationPath = originalData.navigationPath;
      let navigationPathChanged = false;

      if (hasContent(path)) {
         const pathCoords = JSON.parse(path);
         const pathArray = Array.isArray(pathCoords) ? pathCoords : [pathCoords];

         if (pathArray.length > 0 && !arraysEqual(originalData.navigationPath, pathArray)) {
            processedNavigationPath = pathArray;
            navigationPathChanged = true;
         }
      }

      // Update the room with new data
      const updatedRoom = {
         ...existingRoom._doc,
         name: name || existingRoom.name,
         description: description || existingRoom.description,
         floor: floor || existingRoom.floor,
         navigationPath: processedNavigationPath,
         navigationGuide: processedNavigationGuide,
         image: [
            ...retainedImages,
            ...newImages
         ]
      };

      rooms[roomIndex] = updatedRoom;

      // 🔹 Get admin ID and log changes
      const adminId = extractAdminId(req);

      if (adminId) {
         const changes = [];

         // Compare original vs new values
         if (originalData.name !== updatedRoom.name) {
            changes.push(`name changed from "${originalData.name}" to "${updatedRoom.name}"`);
         }
         if (originalData.floor !== updatedRoom.floor) {
            changes.push(`floor changed from ${originalData.floor} to ${updatedRoom.floor}`);
         }
         if (originalData.description !== updatedRoom.description) {
            changes.push('description updated');
         }
         if (newImages.length > 0) {
            changes.push(`${newImages.length} new images added`);
         }
         if (imagesToDelete.length > 0) {
            changes.push(`${imagesToDelete.length} images removed`);
         }
         if (navigationGuideChanged) {
            changes.push('navigation guide updated');
         }
         if (navigationPathChanged) {
            changes.push('navigation path updated');
         }

         const changesSummary = changes.length > 0 ? changes.join(', ') : 'no changes detected';

         // Only log if there are actual changes
         if (changes.length > 0) {
            await systemLogService.logRoomActivity(adminId, "Updated", {
               roomId: roomID,
               roomName: updatedRoom.name,
               buildingId: buildingID,
               buildingName: building.name,
               floor: updatedRoom.floor,
               kioskName: kiosk?.name || kioskID,
               changes: changesSummary
            });
         }
      }

      // Update the building document
      building.existingRoom.set(kioskID, rooms);
      building.markModified('existingRoom');
      await building.save();

      res.status(200).json({
         success: true,
         message: "Room updated successfully!",
         data: updatedRoom,
      });

   } catch (error) {
      console.error("Edit room error:", error);
      res.status(400).json({
         success: false,
         message: error.message,
      });
   }
});

exports.delete_room = asyncHandler(async (req, res) => {
   try {
      const { buildingID, kioskID, roomID } = req.params;

      const room = await room_service.delete_room(buildingID, kioskID, roomID);

      return res.status(201).json({
         success: true,
         message: "Room deleted successfully",
         data: room
      });
   }
   catch (error) {
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
})