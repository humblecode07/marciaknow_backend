const Building = require('../models/building.model');
const Kiosk = require('../models/kiosk.model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const imageService = require('../services/image.service');
const systemLogService = require('../services/systemLog.service');

const extractAdminId = (req) => {
   return req.user?.id || req.adminId;
};

exports.get_buildings = asyncHandler(async (req, res) => {
   try {
      const buildings = await Building.find();
      res.json(buildings);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
});

exports.get_buildings_based_from_kiosk = asyncHandler(async (req, res) => {
   const { kioskID } = req.params;

   try {
      const buildings = await Building.find({
         $or: [
            { [`existingRoom.${kioskID}`]: { $exists: true } },
            { [`navigationPath.${kioskID}`]: { $exists: true } },
            { [`navigationGuide.${kioskID}`]: { $exists: true } }
         ]
      });

      res.json(buildings);
   } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Unexpected error precedented: ' + error.message });
   }
});


exports.get_building = asyncHandler(async (req, res) => {
   const { buildingID } = req.params;

   try {
      const building = await Building.findById(buildingID);
      res.json(building);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
});

exports.add_building = asyncHandler(async (req, res) => {
   const kiosk = await Kiosk.findOne({ kioskID: req.body.kioskID });
   if (!kiosk) return res.status(404).json({ message: "Kiosk not found" });

   try {
      const navigationPath = {
         [req.body.kioskID]: {
            path: req.body.navigationPath || ""
         }
      };

      const navigationGuide = {
         [req.body.kioskID]: req.body.navigationGuide || []
      };

      const newBuilding = await Building.create({
         name: req.body.name,
         description: req.body.description,
         path: req.body.path,
         numberOfFloor: req.body.numberOfFloor,
         existingRoom: req.body.existingRoom || {},
         navigationPath: navigationPath,
         navigationGuide: navigationGuide
      });

      const adminId = extractAdminId(req);

      if (adminId) {
         // Fix: Pass correct parameters - action string and building data
         systemLogService.logBuildingActivity(adminId, "Added", {
            floor: newBuilding.numberOfFloor,
            kioskName: kiosk.name || kiosk.kioskID, // Use kiosk name or ID
            name: newBuilding.name
         });
      }

      res.status(201).json({
         success: true,
         message: "Building added successfully!",
         data: newBuilding
      });
   }
   catch (error) {
      res.status(400).json({
         success: false,
         message: error.message
      });
   }
});

exports.edit_building = asyncHandler(async (req, res) => {
   const { buildingId, kioskID } = req.params;

   try {
      const building = await Building.findById(buildingId);
      if (!building) throw new Error("Building not found");

      const originalData = {
         name: building.name,
         description: building.description,
         numberOfFloor: building.numberOfFloor,
         imageCount: building.image?.length || 0,
         navigationGuide: building.navigationGuide?.get(kioskID) || [],
         navigationPath: building.navigationPath?.get(kioskID) || []
      };

      const { name, description, path, floor } = req.body;
      const files = req.files;

      // 🔹 Basic building info
      building.name = name || building.name;
      building.description = description || building.description;
      building.numberOfFloor = floor || building.numberOfFloor;

      // 🔹 Handle building images (existing logic)
      const buildingImages = files?.buildingImages || [];
      const newBuildingImages = buildingImages.length ? await imageService.process_images(buildingImages) : [];

      let retainedImageIDs = [];
      if (req.body.imageIDs) {
         retainedImageIDs = Array.isArray(req.body.imageIDs)
            ? req.body.imageIDs
            : JSON.parse(req.body.imageIDs);
      }

      const imagesToDelete = building.image?.filter(img =>
         !retainedImageIDs.includes(img._id.toString())
      ) || [];

      if (imagesToDelete.length > 0) {
         try {
            await imageService.delete_images(imagesToDelete);
         } catch (deleteErr) {
            console.error('Error deleting images:', deleteErr);
         }
      }

      const retainedImages = building.image?.filter(img =>
         retainedImageIDs.includes(img._id.toString())
      ) || [];

      building.image = [
         ...retainedImages,
         ...newBuildingImages
      ];

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

      let navigationGuideChanged = false;
      let navigationPathChanged = false;

      // 🔹 Update navigationGuide for this kiosk (existing logic)
      if (hasContent(req.body.navigationGuide)) {
         const guideArray = JSON.parse(req.body.navigationGuide);

         if (!Array.isArray(guideArray)) {
            throw new Error("navigationGuide should be an array");
         }

         if (!arraysEqual(originalData.navigationGuide, guideArray)) {
            if (!building.navigationGuide) building.navigationGuide = new Map();
            building.navigationGuide.set(kioskID, guideArray);
            navigationGuideChanged = true;
         }
      }

      // 🔹 Update navigationPath for this kiosk (existing logic)
      if (hasContent(path)) {
         const pathCoords = JSON.parse(path);
         const pathArray = Array.isArray(pathCoords) ? pathCoords : [pathCoords];

         if (pathArray.length > 0) {
            if (!arraysEqual(originalData.navigationPath, pathArray)) {
               if (!building.navigationPath) building.navigationPath = new Map();
               building.navigationPath.set(kioskID, pathArray);
               navigationPathChanged = true;
            }
         }
      }

      // 🔹 Handle rooms update with image support
      let roomsChanged = false;

      if (hasContent(req.body.rooms)) {
         let roomsData;
         try {
            roomsData = typeof req.body.rooms === 'string'
               ? JSON.parse(req.body.rooms)
               : req.body.rooms;
         } catch (parseError) {
            throw new Error("Invalid rooms data format");
         }

         if (!building.rooms) building.rooms = new Map();

         const originalRooms = {};
         for (let [floorNum, floorRooms] of building.rooms.entries()) {
            originalRooms[floorNum] = JSON.parse(JSON.stringify(floorRooms));
         }

         // Process room images for each floor
         for (const [floorNumber, floorRooms] of Object.entries(roomsData)) {
            if (Array.isArray(floorRooms) && floorRooms.length > 0) {
               const processedRooms = [];

               for (const room of floorRooms) {
                  // Handle room images
                  let roomImages = [];
                  const roomImageFiles = files?.[`room_${room.id}_images`] || [];

                  if (roomImageFiles.length > 0) {
                     try {
                        roomImages = await imageService.process_images(roomImageFiles);
                     } catch (imageError) {
                        console.error(`Error processing images for room ${room.id}:`, imageError);
                        // Continue processing other rooms even if one fails
                     }
                  }

                  // Handle retained room images
                  let retainedRoomImages = [];
                  const retainedRoomImageIds = room.retainedImageIds || [];

                  if (retainedRoomImageIds.length > 0) {
                     // Find existing room to get current images
                     const existingFloorRooms = building.rooms.get(floorNumber) || [];
                     const existingRoom = existingFloorRooms.find(r => r.id === room.id);

                     if (existingRoom && existingRoom.images) {
                        retainedRoomImages = existingRoom.images.filter(img =>
                           retainedRoomImageIds.includes(img._id.toString())
                        );

                        // Delete images that are no longer retained
                        const imagesToDeleteForRoom = existingRoom.images.filter(img =>
                           !retainedRoomImageIds.includes(img._id.toString())
                        );

                        if (imagesToDeleteForRoom.length > 0) {
                           try {
                              await imageService.delete_images(imagesToDeleteForRoom);
                           } catch (deleteErr) {
                              console.error(`Error deleting room ${room.id} images:`, deleteErr);
                           }
                        }
                     }
                  }

                  // Combine retained and new images
                  const finalRoomImages = [...retainedRoomImages, ...roomImages];
                  const imageIds = finalRoomImages.map(img => img._id.toString());

                  const processedRoom = {
                     id: room.id,
                     x: Number(room.x),
                     y: Number(room.y),
                     width: Number(room.width),
                     height: Number(room.height),
                     label: room.label,
                     color: room.color,
                     floor: Number(floorNumber),
                     navigationPath: room.navigationPath || [],
                     navigationGuide: room.navigationGuide || [],
                     images: finalRoomImages,
                     imageIds: imageIds,
                     description: room.description,
                     createdAt: room.createdAt || new Date(),
                     updatedAt: new Date()
                  };

                  processedRooms.push(processedRoom);
               }

               const originalFloorRooms = originalRooms[floorNumber] || [];
               if (!arraysEqual(originalFloorRooms, processedRooms)) {
                  building.rooms.set(floorNumber, processedRooms);
                  roomsChanged = true;
               }
            } else {
               if (building.rooms.has(floorNumber)) {
                  // Before deleting, clean up room images
                  const roomsToDelete = building.rooms.get(floorNumber) || [];
                  for (const room of roomsToDelete) {
                     if (room.images && room.images.length > 0) {
                        try {
                           await imageService.delete_images(room.images);
                        } catch (deleteErr) {
                           console.error(`Error deleting images for room ${room.id}:`, deleteErr);
                        }
                     }
                  }
                  building.rooms.delete(floorNumber);
                  roomsChanged = true;
               }
            }
         }
      }

      // 🔹 Handle stairs update (existing logic)
      let stairsChanged = false;

      if (hasContent(req.body.stairs)) {
         let stairsData;
         try {
            stairsData = typeof req.body.stairs === 'string'
               ? JSON.parse(req.body.stairs)
               : req.body.stairs;
         } catch (parseError) {
            throw new Error("Invalid stairs data format");
         }

         if (!building.stairs) building.stairs = new Map();

         const originalStairs = {};
         for (let [floorNum, floorStairs] of building.stairs.entries()) {
            originalStairs[floorNum] = JSON.parse(JSON.stringify(floorStairs));
         }

         for (const [floorNumber, floorStairs] of Object.entries(stairsData)) {
            if (Array.isArray(floorStairs) && floorStairs.length > 0) {
               const processedStairs = floorStairs.map(stair => ({
                  id: stair.id,
                  type: stair.type || 'stairs',
                  x: Number(stair.x),
                  y: Number(stair.y),
                  width: Number(stair.width),
                  height: Number(stair.height),
                  label: stair.label,
                  floor: Number(floorNumber),
                  direction: stair.direction,
                  createdAt: stair.createdAt || new Date(),
                  updatedAt: new Date()
               }));

               const originalFloorStairs = originalStairs[floorNumber] || [];
               if (!arraysEqual(originalFloorStairs, processedStairs)) {
                  building.stairs.set(floorNumber, processedStairs);
                  stairsChanged = true;
               }
            } else {
               if (building.stairs.has(floorNumber)) {
                  building.stairs.delete(floorNumber);
                  stairsChanged = true;
               }
            }
         }
      }

      // 🔹 Logging (updated to include room changes)
      const adminId = extractAdminId(req);

      if (adminId) {
         const changes = [];

         if (originalData.name !== building.name) {
            changes.push(`name changed from "${originalData.name}" to "${building.name}"`);
         }
         if (originalData.numberOfFloor !== building.numberOfFloor) {
            changes.push(`floors changed from ${originalData.numberOfFloor} to ${building.numberOfFloor}`);
         }
         if (originalData.description !== building.description) {
            changes.push('description updated');
         }
         if (newBuildingImages.length > 0) {
            changes.push(`${newBuildingImages.length} new building images added`);
         }
         if (imagesToDelete.length > 0) {
            changes.push(`${imagesToDelete.length} building images removed`);
         }
         if (navigationGuideChanged) {
            changes.push('navigation guide updated');
         }
         if (navigationPathChanged) {
            changes.push('navigation path updated');
         }
         if (roomsChanged) {
            changes.push('rooms updated');
         }
         if (stairsChanged) {
            changes.push('stairs updated');
         }

         const changesSummary = changes.length > 0 ? changes.join(', ') : 'no changes detected';

         if (changes.length > 0) {
            const kiosk = await Kiosk.findOne({ kioskID });

            await systemLogService.logBuildingActivity(adminId, "Updated", {
               floor: building.numberOfFloor,
               kioskName: kiosk?.name || kioskID,
               name: building.name,
               buildingId: building._id,
               changes: changesSummary
            });
         }
      }

      const updatedBuilding = await building.save();

      res.status(200).json({
         success: true,
         message: "Building updated successfully!",
         data: updatedBuilding,
      });

   } catch (error) {
      console.error("Edit building error:", error);
      res.status(400).json({
         success: false,
         message: error.message,
      });
   }
});