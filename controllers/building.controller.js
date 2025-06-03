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
         // Store original navigation data for comparison
         navigationGuide: building.navigationGuide?.get(kioskID) || [],
         navigationPath: building.navigationPath?.get(kioskID) || []
      };

      const { name, description, path, floor } = req.body;
      const files = req.files;

      // 🔹 Basic building info
      building.name = name || building.name;
      building.description = description || building.description;
      building.numberOfFloor = floor || building.numberOfFloor;

      const newImages = files?.length ? await imageService.process_images(files) : [];

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
         ...newImages
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

      // Helper function to compare arrays deeply
      const arraysEqual = (a, b) => {
         if (!Array.isArray(a) || !Array.isArray(b)) return false;
         if (a.length !== b.length) return false;
         return JSON.stringify(a) === JSON.stringify(b);
      };

      let navigationGuideChanged = false;
      let navigationPathChanged = false;

      // 🔹 Update navigationGuide for this kiosk (only if content exists AND changed)
      if (hasContent(req.body.navigationGuide)) {
         const guideArray = JSON.parse(req.body.navigationGuide);

         if (!Array.isArray(guideArray)) {
            throw new Error("navigationGuide should be an array");
         }

         // Compare with original data
         if (!arraysEqual(originalData.navigationGuide, guideArray)) {
            if (!building.navigationGuide) building.navigationGuide = new Map();
            building.navigationGuide.set(kioskID, guideArray);
            navigationGuideChanged = true;
         }
      }

      // 🔹 Update navigationPath for this kiosk (only if content exists AND changed)
      if (hasContent(path)) {
         const pathCoords = JSON.parse(path);
         const pathArray = Array.isArray(pathCoords) ? pathCoords : [pathCoords];

         if (pathArray.length > 0) {
            // Compare with original data
            if (!arraysEqual(originalData.navigationPath, pathArray)) {
               if (!building.navigationPath) building.navigationPath = new Map();
               building.navigationPath.set(kioskID, pathArray);
               navigationPathChanged = true;
            }
         }
      }

      // 🔹 Get admin ID and log changes
      const adminId = extractAdminId(req);

      if (adminId) {
         const changes = [];

         // Compare original vs new values
         if (originalData.name !== building.name) {
            changes.push(`name changed from "${originalData.name}" to "${building.name}"`);
         }
         if (originalData.numberOfFloor !== building.numberOfFloor) {
            changes.push(`floors changed from ${originalData.numberOfFloor} to ${building.numberOfFloor}`);
         }
         if (originalData.description !== building.description) {
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